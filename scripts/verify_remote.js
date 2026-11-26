// Remote website verification (used for staging and production smoke tests).
//
// Checks (all must pass in the SAME attempt, so a partially-cached site never passes):
//   - /data/release_metadata.json month == expected (and, if EXPECTED_METADATA_FILE is set,
//     generated_at fingerprint == the metadata committed in the release commit)
//   - optional DEPLOYMENT_URL (immutable Vercel URL proven to belong to EXPECTED_SHA)
//     serves the same metadata fingerprint as BASE_URL
//   - header-update-time month on home / airport / airline pages
//   - latest monthly report page, sitemap link, and flight_data_all.json latest month
//
// Stale content (old month / old fingerprint) is retried every VERIFY_POLL_INTERVAL_SECONDS
// until VERIFY_FRESHNESS_TIMEOUT_SECONDS, then fails. HTTP errors are retried per URL.
// Requests carry a cache-busting query + no-cache headers; site cache headers are untouched.

const fs = require('fs');
const path = require('path');

class VerifyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code; // SITE_STALE | SITE_HTTP_ERROR | SITE_CONTENT_ERROR
    this.details = details;
  }
}

function maxMonth(rows) {
  return rows.reduce((best, r) => {
    const year = Number(r.year), month = Number(r.month), key = year * 100 + month;
    return key > best.key ? { key, year, month } : best;
  }, { key: 0, year: 0, month: 0 });
}

function ym(x) {
  return x && x.year ? `${x.year}-${String(x.month).padStart(2, '0')}` : 'unknown';
}

function buildChecks(root, expectedYear, expectedMonth) {
  const fromFile = rel => maxMonth(JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')));
  return [
    ['/', { year: expectedYear, month: expectedMonth }],
    ['/airport/tpe/', fromFile('data/flight_data_airport-tpe.json')],
    ['/airport/khh/', fromFile('data/flight_data_airport-khh.json')],
    ['/airport/tsa/', fromFile('data/flight_data_airport-tsa.json')],
    ['/airport/rmq/', fromFile('data/flight_data_airport-rmq.json')],
    ['/airport/tnn/', fromFile('data/flight_data_airport-tnn.json')],
    ['/airport/hun/', fromFile('data/flight_data_airport-hun.json')],
    ['/airline/cal/', fromFile('data/flight_data_airline-cal.json')],
    ['/airline/eva/', fromFile('data/flight_data_airline-eva.json')],
    ['/airline/starlux/', fromFile('data/flight_data_airline-starlux.json')],
    ['/airline/tiger/', fromFile('data/flight_data_airline-tiger.json')],
  ];
}

async function verifyRemote({
  baseUrl,
  expectedYear,
  expectedMonth,
  root = path.resolve(__dirname, '..'),
  checks,
  expectedMetadata = null,
  deploymentUrl = '',
  cacheBust = String(Date.now()),
  freshnessTimeoutMs = 3 * 60 * 1000,
  intervalMs = 10 * 1000,
  httpAttempts = 12,
  httpRetryDelayMs = 10 * 1000,
  requestTimeoutMs = 30 * 1000,
  fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(r => setTimeout(r, ms)),
  now = Date.now,
  log = console.log,
}) {
  baseUrl = (baseUrl || '').replace(/\/$/, '');
  deploymentUrl = (deploymentUrl || '').replace(/\/$/, '');
  if (!baseUrl || !expectedYear || !expectedMonth) throw new Error('BASE_URL, EXPECTED_YEAR and EXPECTED_MONTH are required');
  // NaN / non-positive values would make the freshness loop never terminate.
  for (const [name, v] of Object.entries({ freshnessTimeoutMs, intervalMs, httpAttempts, requestTimeoutMs })) {
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number, got "${v}"`);
  }
  const expected = { year: expectedYear, month: expectedMonth };
  checks = checks || buildChecks(root, expectedYear, expectedMonth);

  function withCacheBust(url) {
    if (!cacheBust) return url;
    return url + (url.includes('?') ? '&' : '?') + `_verify=${encodeURIComponent(cacheBust)}`;
  }

  async function getWithRetry(url) {
    let last;
    for (let i = 0; i < httpAttempts; i++) {
      try {
        const res = await fetchImpl(withCacheBust(url), {
          redirect: 'follow',
          cache: 'no-store',
          signal: AbortSignal.timeout(requestTimeoutMs),
          headers: { 'user-agent': 'flightdata2-release-check/1.0', 'cache-control': 'no-cache', pragma: 'no-cache' },
        });
        const text = await res.text();
        if (res.ok) return { res, text };
        last = new Error(`${url}: HTTP ${res.status}`);
      } catch (e) { last = e; }
      if (i < httpAttempts - 1) await sleep(httpRetryDelayMs);
    }
    throw new VerifyError('SITE_HTTP_ERROR', (last && last.message) || `Failed to fetch ${url}`, { url });
  }

  const stale = (message, details) => new VerifyError('SITE_STALE', message, details);

  async function checkMetadata(siteUrl, label) {
    const { res, text } = await getWithRetry(siteUrl + '/data/release_metadata.json');
    let meta;
    try { meta = JSON.parse(text); } catch { throw stale(`${label} release_metadata.json is not valid JSON`, { actual: null }); }
    const actual = { year: Number(meta.latest_year), month: Number(meta.latest_month) };
    const cacheInfo = res.headers && res.headers.get ? res.headers.get('x-vercel-cache') : null;
    if (actual.year !== expected.year || actual.month !== expected.month) {
      throw stale(`${label} release_metadata.json shows ${ym(actual)}; expected ${ym(expected)}`, { actual, url: siteUrl });
    }
    if (expectedMetadata && expectedMetadata.generated_at && meta.generated_at !== expectedMetadata.generated_at) {
      throw stale(`${label} release_metadata.json generated_at ${meta.generated_at} != release commit ${expectedMetadata.generated_at} (old build or cache)`,
        { actual, url: siteUrl });
    }
    if (expectedMetadata && expectedMetadata.status && meta.status !== expectedMetadata.status) {
      throw stale(`${label} release_metadata.json status ${meta.status} != ${expectedMetadata.status}`, { actual, url: siteUrl });
    }
    log(`OK ${label} /data/release_metadata.json -> ${ym(actual)}${meta.generated_at ? ` (${meta.generated_at})` : ''}${cacheInfo ? ` [x-vercel-cache=${cacheInfo}]` : ''}`);
    return meta;
  }

  async function attemptOnce() {
    if (deploymentUrl) await checkMetadata(deploymentUrl, 'deployment');
    await checkMetadata(baseUrl, 'site');

    for (const [route, exp] of checks) {
      const url = baseUrl + route;
      const { text } = await getWithRetry(url);
      const match = text.match(/id=["']header-update-time["'][^>]*>(\d{4})年(\d{1,2})月</);
      if (!match) throw new VerifyError('SITE_CONTENT_ERROR', `No update month found at ${url}`, { url });
      const actual = { year: Number(match[1]), month: Number(match[2]) };
      if (actual.year !== exp.year || actual.month !== exp.month) {
        throw stale(`${url} shows ${actual.year}-${actual.month}; expected ${exp.year}-${exp.month}`, { actual, url });
      }
      log(`OK ${route} -> ${ym(actual)}`);
    }

    const month2 = String(expectedMonth).padStart(2, '0');
    const reportRoute = `/insights/${expectedYear}-${month2}-taiwan-aviation-monthly-report/`;
    const reportRes = await getWithRetry(baseUrl + reportRoute).catch(err => {
      // A missing report for the new month on an otherwise-old site is staleness, not a hard error.
      throw stale(`${err.message} (monthly report not yet available)`, { url: baseUrl + reportRoute });
    });
    if (!reportRes.text.includes(`${expectedYear} 年 ${expectedMonth} 月台灣航空月報`)) {
      throw stale(`Monthly report content mismatch at ${baseUrl + reportRoute}`, { url: baseUrl + reportRoute });
    }
    log(`OK ${reportRoute} -> monthly report present`);

    const sitemapRes = await getWithRetry(baseUrl + '/sitemap.xml');
    if (!sitemapRes.text.includes(reportRoute)) throw stale(`sitemap.xml missing ${reportRoute}`, { url: baseUrl + '/sitemap.xml' });
    log('OK /sitemap.xml -> latest monthly report linked');

    const dataRes = await getWithRetry(baseUrl + '/data/flight_data_all.json');
    const latest = maxMonth(JSON.parse(dataRes.text));
    if (latest.year !== expectedYear || latest.month !== expectedMonth) {
      throw stale(`Remote dataset latest ${latest.year}-${latest.month} != expected ${expectedYear}-${expectedMonth}`, { actual: latest });
    }
    log(`Remote verification passed: ${baseUrl} -> ${ym(expected)}`);
  }

  const start = now();
  let attempt = 0;
  let lastActual = null;
  for (;;) {
    attempt += 1;
    try {
      await attemptOnce();
      return { ok: true, attempts: attempt, waitedMs: now() - start };
    } catch (err) {
      if (!(err instanceof VerifyError) || err.code !== 'SITE_STALE') {
        if (err instanceof VerifyError) { err.details.expected = expected; err.details.lastActual = lastActual; }
        throw err;
      }
      if (err.details.actual) lastActual = err.details.actual;
      const remaining = freshnessTimeoutMs - (now() - start);
      log(`[verify] attempt ${attempt} stale: ${err.message}`);
      if (remaining <= 0) {
        err.message = `Website still stale after ${Math.round(freshnessTimeoutMs / 1000)}s: ${err.message}`;
        err.details.expected = expected;
        err.details.lastActual = lastActual;
        throw err;
      }
      await sleep(Math.min(intervalMs, remaining));
    }
  }
}

function oneLine(value) {
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').slice(0, 500);
}

async function main() {
  const root = path.resolve(process.env.RELEASE_ROOT || path.resolve(__dirname, '..'));
  const metadataFile = process.env.EXPECTED_METADATA_FILE;
  const expectedMetadata = metadataFile
    ? JSON.parse(fs.readFileSync(path.resolve(root, metadataFile), 'utf8'))
    : null;
  try {
    const result = await verifyRemote({
      baseUrl: process.env.BASE_URL,
      expectedYear: Number(process.env.EXPECTED_YEAR),
      expectedMonth: Number(process.env.EXPECTED_MONTH),
      root,
      expectedMetadata,
      deploymentUrl: process.env.DEPLOYMENT_URL || '',
      cacheBust: (process.env.EXPECTED_SHA || '').slice(0, 12) + '-' + Date.now(),
      freshnessTimeoutMs: Number(process.env.VERIFY_FRESHNESS_TIMEOUT_SECONDS || 180) * 1000,
      intervalMs: Number(process.env.VERIFY_POLL_INTERVAL_SECONDS || 10) * 1000,
    });
    console.log(`Website verification passed after ${result.attempts} attempt(s)${process.env.EXPECTED_SHA ? ` for commit ${process.env.EXPECTED_SHA}` : ''}`);
  } catch (err) {
    console.error(`::error title=Website verification failed::${oneLine(err.message)}`);
    if (process.env.GITHUB_ENV) {
      const d = err.details || {};
      const exp = d.expected || {};
      const act = d.lastActual || d.actual || {};
      const lines = {
        FAILURE_TYPE: 'site_verification_failed',
        FAILURE_DETAIL: err.message,
        EXPECTED_SITE_MONTH: exp.year ? `${exp.year}/${String(exp.month).padStart(2, '0')}` : '',
        ACTUAL_SITE_MONTH: act.year ? `${act.year}/${String(act.month).padStart(2, '0')}` : 'unknown',
      };
      fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(lines).map(([k, v]) => `${k}=${oneLine(v)}\n`).join(''));
    }
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { verifyRemote, VerifyError, maxMonth };
