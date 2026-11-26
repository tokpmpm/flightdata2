// Mock-based tests for the staging release verification pipeline:
//   scripts/wait_for_vercel_deployment.js  (wait for Vercel READY on the exact commit)
//   scripts/verify_remote.js               (website freshness + content verification)
//   scripts/send_update_email.py           (failure classification, EMAIL_DRY_RUN)
// No network, no Vercel/GitHub calls, no production changes. Run: node tests/test_release_verification.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync, spawn } = require('child_process');
const { waitForVercelDeployment } = require('../scripts/wait_for_vercel_deployment');
const { verifyRemote } = require('../scripts/verify_remote');

const ROOT = path.resolve(__dirname, '..');
const SHA = '6e00cce373a08feda82f670d45103c0b1c383f1a';
const OLD_SHA = '61cf6a81116a310a0109f034229e8c56f32f42e8';
const REPO = 'tokpmpm/flightdata2';
const NEW_META = { latest_year: 2026, latest_month: 10, status: 'staging', generated_at: '2026-11-25T13:45:47.470Z' };
const OLD_META = { latest_year: 2026, latest_month: 9, status: 'staging', generated_at: '2026-10-27T09:29:13.178Z' };

// ---------- fake clock ----------
function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async ms => { t += ms; }, advance: ms => { t += ms; } };
}
const resp = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: k => headers[k.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

// ---------- mock GitHub API (what Vercel reports back) ----------
// readyAt: ms after start when deployment becomes success; failAt: becomes failure; null = never.
function mockGithub(clock, { createdAt = 0, readyAt = null, failAt = null, deploySha = SHA, commitFailAt = null, httpStatus = null } = {}) {
  return async url => {
    const t = clock.now();
    if (httpStatus) return resp(httpStatus, { message: 'nope' });
    if (url.includes('/deployments?sha=')) {
      if (t < createdAt) return resp(200, []);
      return resp(200, [{ id: 8059295000, sha: deploySha, environment: 'Preview', creator: { login: 'vercel[bot]' }, created_at: '2026-11-25T13:46:04Z' }]);
    }
    if (url.includes('/deployments/') && url.includes('/statuses')) {
      let state = 'in_progress';
      if (failAt !== null && t >= failAt) state = 'failure';
      else if (readyAt !== null && t >= readyAt) state = 'success';
      return resp(200, [{ state, environment_url: 'https://flightdata2-staging-hjmodcy78-tokpmpms-projects.vercel.app' }]);
    }
    if (url.includes('/commits/')) {
      if (commitFailAt !== null && t >= commitFailAt) return resp(200, [{ context: 'Vercel', state: 'failure', description: 'Build failed', created_at: '2' }]);
      return resp(200, [{ context: 'Vercel', state: 'pending', created_at: '1' }]);
    }
    return resp(404, {});
  };
}

// ---------- mock website ----------
// newAt: ms when the alias starts serving the new build (null = never).
// cache: per-path overrides that keep serving old content forever (simulates stale CDN/cache).
function page(y, m) { return `<html><span id="header-update-time">${y}年${String(m).padStart(2, '0')}月</span></html>`; }
function mockSite(clock, { newAt = 0, cachedPaths = [], metaOverride = null, seen } = {}) {
  return async (url, opts) => {
    if (seen) seen.push({ url, opts });
    const u = new URL(url);
    const isNew = newAt !== null && clock.now() >= newAt && !cachedPaths.includes(u.pathname);
    const meta = isNew ? (metaOverride || NEW_META) : OLD_META;
    const y = meta.latest_year, m = meta.latest_month;
    switch (u.pathname) {
      case '/data/release_metadata.json': return resp(200, meta, { 'x-vercel-cache': 'MISS' });
      case '/': case '/airport/tpe/': return resp(200, page(y, m));
      case '/insights/2026-10-taiwan-aviation-monthly-report/':
        return isNew ? resp(200, '2026 年 10 月台灣航空月報') : resp(404, 'not found');
      case '/sitemap.xml': return resp(200, isNew ? '/insights/2026-10-taiwan-aviation-monthly-report/' : '/insights/2026-09-taiwan-aviation-monthly-report/');
      case '/data/flight_data_all.json': return resp(200, [{ year: y, month: m }]);
      default: return resp(404, '');
    }
  };
}

const CHECKS = [['/', { year: 2026, month: 10 }], ['/airport/tpe/', { year: 2026, month: 10 }]];

// Full staging pipeline as the workflow runs it: wait READY -> verify site.
async function runPipeline({ gh = {}, site = {}, verify = {} }) {
  const clock = fakeClock();
  const logs = [];
  const log = m => logs.push(m);
  let deployment;
  try {
    deployment = await waitForVercelDeployment({
      repo: REPO, sha: SHA, token: 'x', environment: 'Preview',
      timeoutMs: 300000, intervalMs: 5000, fetchImpl: mockGithub(clock, gh), sleep: clock.sleep, now: clock.now, log,
    });
  } catch (err) {
    return { outcome: 'deployment', code: err.code, err, t: clock.now(), logs };
  }
  const readyT = clock.now();
  // Site content is relative to the moment the deployment became READY.
  const siteOpts = { ...site, newAt: site.newAt === null ? null : readyT + (site.newAt || 0) };
  try {
    const r = await verifyRemote({
      baseUrl: 'https://staging.example', expectedYear: 2026, expectedMonth: 10, checks: CHECKS,
      expectedMetadata: NEW_META, deploymentUrl: verify.deploymentUrl || '', cacheBust: SHA.slice(0, 12),
      freshnessTimeoutMs: 180000, intervalMs: 10000, httpAttempts: 2, httpRetryDelayMs: 1000,
      fetchImpl: mockSite(clock, siteOpts), sleep: clock.sleep, now: clock.now, log,
    });
    return { outcome: 'passed', deployment, readyT, t: clock.now(), verify: r, logs };
  } catch (err) {
    return { outcome: 'site', code: err.code, err, deployment, readyT, t: clock.now(), logs };
  }
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ===== Scenario matrix requested in the task =====
test('1. Vercel 立即 READY → 正常進入驗收並通過', async () => {
  const r = await runPipeline({ gh: { readyAt: 0 } });
  assert.strictEqual(r.outcome, 'passed', r.err && r.err.message);
  assert.strictEqual(r.readyT, 0);
  assert.strictEqual(r.deployment.sha, SHA);
});

test('2. Vercel 延遲 15 秒 READY → 等待後驗收通過（不會在 READY 前驗收）', async () => {
  const r = await runPipeline({ gh: { readyAt: 15000 } });
  assert.strictEqual(r.outcome, 'passed', r.err && r.err.message);
  assert.ok(r.readyT >= 15000 && r.readyT <= 20000, `readyT=${r.readyT}`);
});

test('3. Vercel 延遲 60 秒 READY（且部署紀錄 20 秒後才出現）→ 等待後驗收通過', async () => {
  const r = await runPipeline({ gh: { createdAt: 20000, readyAt: 60000 } });
  assert.strictEqual(r.outcome, 'passed', r.err && r.err.message);
  assert.ok(r.readyT >= 60000 && r.readyT <= 65000, `readyT=${r.readyT}`);
});

test('4. Vercel 部署 FAILED → 停止驗收，分類為部署失敗', async () => {
  const r = await runPipeline({ gh: { failAt: 30000 } });
  assert.strictEqual(r.outcome, 'deployment');
  assert.strictEqual(r.code, 'DEPLOYMENT_FAILED');
  assert.strictEqual(r.err.details.state, 'failure');
  assert.ok(r.t < 300000, 'should stop early, not wait for timeout');
});

test('4b. Vercel build 失敗（只有 commit status failure，無 deployment 紀錄）→ 部署失敗', async () => {
  const r = await runPipeline({ gh: { createdAt: Infinity, commitFailAt: 25000 } });
  assert.strictEqual(r.code, 'DEPLOYMENT_FAILED');
  assert.match(r.err.message, /Build failed/);
});

test('5. Vercel 超過 5 分鐘未 READY → 逾時，分類為部署逾時', async () => {
  const r = await runPipeline({ gh: { readyAt: null } });
  assert.strictEqual(r.outcome, 'deployment');
  assert.strictEqual(r.code, 'DEPLOYMENT_TIMEOUT');
  assert.ok(r.t >= 300000 && r.t <= 305000, `t=${r.t}`);
  assert.strictEqual(r.err.details.state, 'in_progress');
});

test('6. 部署 READY 但網站仍顯示 9 月 → 網站驗收失敗（記錄預期 / 實際月份）', async () => {
  const r = await runPipeline({ gh: { readyAt: 13000 }, site: { newAt: null } });
  assert.strictEqual(r.outcome, 'site');
  assert.strictEqual(r.code, 'SITE_STALE');
  assert.deepStrictEqual(r.err.details.expected, { year: 2026, month: 10 });
  assert.deepStrictEqual(r.err.details.lastActual, { year: 2026, month: 9 });
  assert.match(r.err.message, /still stale after 180s/);
});

test('6b. READY 後網站 25 秒才切換到新版 → 重試後通過', async () => {
  const r = await runPipeline({ gh: { readyAt: 13000 }, site: { newAt: 25000 } });
  assert.strictEqual(r.outcome, 'passed', r.err && r.err.message);
  assert.ok(r.verify.attempts >= 3);
});

test('7. 網站顯示 10 月且 commit 正確（immutable deployment URL 指紋一致）→ 驗收成功', async () => {
  const r = await runPipeline({ gh: { readyAt: 0 }, verify: { deploymentUrl: 'https://flightdata2-staging-hjmodcy78.example' } });
  assert.strictEqual(r.outcome, 'passed', r.err && r.err.message);
  assert.ok(r.logs.some(l => l.startsWith('OK deployment /data/release_metadata.json -> 2026-10')));
  assert.ok(r.logs.some(l => l.startsWith('OK site /data/release_metadata.json -> 2026-10')));
});

test('8a. 快取：頁面已是 10 月但 flight_data_all.json 仍是舊資料 → 不可誤判成功', async () => {
  const r = await runPipeline({ gh: { readyAt: 0 }, site: { cachedPaths: ['/data/flight_data_all.json'] } });
  assert.strictEqual(r.outcome, 'site');
  assert.strictEqual(r.code, 'SITE_STALE');
  assert.match(r.err.message, /Remote dataset latest 2026-9/);
});

test('8b. 快取：metadata 月份為 10 月但 generated_at 不是本次 commit（舊 build）→ 不可誤判成功', async () => {
  const r = await runPipeline({ gh: { readyAt: 0 }, site: { metaOverride: { ...NEW_META, generated_at: '2026-11-01T00:00:00.000Z' } } });
  assert.strictEqual(r.code, 'SITE_STALE');
  assert.match(r.err.message, /generated_at/);
});

test('8c. 快取：首頁 HTML 仍被快取為 9 月 → 不可誤判成功', async () => {
  const r = await runPipeline({ gh: { readyAt: 0 }, site: { cachedPaths: ['/'] } });
  assert.strictEqual(r.code, 'SITE_STALE');
  assert.match(r.err.message, /shows 2026-9; expected 2026-10/);
});

// ===== Additional guards =====
test('只有其他 commit 的部署 READY → 不接受，最終逾時', async () => {
  const r = await runPipeline({ gh: { readyAt: 0, deploySha: OLD_SHA } });
  assert.strictEqual(r.code, 'DEPLOYMENT_TIMEOUT');
});

test('GitHub API 權限不足（403）→ 部署狀態無法確認，不進入驗收', async () => {
  const r = await runPipeline({ gh: { httpStatus: 403 } });
  assert.strictEqual(r.code, 'DEPLOYMENT_LOOKUP_FAILED');
});

test('驗收請求帶 cache-busting 參數與 no-cache 標頭', async () => {
  const clock = fakeClock();
  const seen = [];
  await verifyRemote({ baseUrl: 'https://s.example', expectedYear: 2026, expectedMonth: 10, checks: CHECKS, cacheBust: 'abc',
    fetchImpl: mockSite(clock, { seen }), sleep: clock.sleep, now: clock.now, log: () => {} });
  assert.ok(seen.length > 0);
  for (const { url, opts } of seen) {
    assert.match(url, /[?&]_verify=abc$/);
    assert.strictEqual(opts.headers['cache-control'], 'no-cache');
  }
});

test('非短 SHA：EXPECTED_SHA 必須為完整 40 字元', async () => {
  await assert.rejects(waitForVercelDeployment({ repo: REPO, sha: '6e00cce' }), /40-char/);
});

// ===== CLI-level: GITHUB_ENV export + email classification (dry run, no SMTP) =====
function startServer(handler) {
  return new Promise(resolve => {
    const srv = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(srv));
  });
}
function runNode(script, env) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, cwd: ROOT });
    let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    p.on('close', code => resolve({ code, out }));
  });
}
function emailDryRun(envFile, extra = {}) {
  const env = { PATH: process.env.PATH, EMAIL_DRY_RUN: '1', NOTIFY_KIND: 'update_failed', LATEST_YEAR: '2026', LATEST_MONTH: '10',
    RELEASE_COMMIT: SHA, ERROR_STAGE: 'x', ...extra };
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const i = line.indexOf('='); if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  const r = spawnSync('python3', ['scripts/send_update_email.py'], { cwd: ROOT, env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout;
}

test('CLI：部署逾時 → GITHUB_ENV 記錄 deployment_timeout，Email 主旨為「Staging 部署逾時」', async () => {
  const srv = await startServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url.includes('/deployments?sha=')) return res.end(JSON.stringify([{ id: 1, sha: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' }, created_at: '1' }]));
    if (req.url.includes('/statuses?per_page=1')) return res.end(JSON.stringify([{ state: 'in_progress' }]));
    return res.end('[]');
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd2-'));
  const envFile = path.join(tmp, 'env'); fs.writeFileSync(envFile, '');
  const r = await runNode('scripts/wait_for_vercel_deployment.js', {
    GITHUB_API_URL: `http://127.0.0.1:${srv.address().port}`, GITHUB_REPOSITORY: REPO, EXPECTED_SHA: SHA,
    VERCEL_WAIT_TIMEOUT_SECONDS: '1', VERCEL_POLL_INTERVAL_SECONDS: '0.3', GITHUB_ENV: envFile, GITHUB_OUTPUT: path.join(tmp, 'out'),
  });
  srv.close();
  assert.strictEqual(r.code, 1, r.out);
  const envText = fs.readFileSync(envFile, 'utf8');
  assert.match(envText, /^FAILURE_TYPE=deployment_timeout$/m);
  assert.match(envText, /^DEPLOYMENT_STATE=in_progress$/m);
  const mail = emailDryRun(envFile);
  assert.match(mail, /Subject: \[FlightData2\] 2026\/10 Staging 部署逾時/);
  assert.match(mail, /沒有執行網站驗收/);
  assert.match(mail, /6e00cce373a0/);
});

test('CLI：READY → GITHUB_OUTPUT 帶出 deployment_url / sha', async () => {
  const srv = await startServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url.includes('/deployments?sha=')) return res.end(JSON.stringify([{ id: 7, sha: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' }, created_at: '1' }]));
    if (req.url.includes('/statuses?per_page=1')) return res.end(JSON.stringify([{ state: 'success', environment_url: 'https://dpl.example' }]));
    return res.end('[]');
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd2-'));
  const out = path.join(tmp, 'out');
  const r = await runNode('scripts/wait_for_vercel_deployment.js', {
    GITHUB_API_URL: `http://127.0.0.1:${srv.address().port}`, GITHUB_REPOSITORY: REPO, EXPECTED_SHA: SHA,
    VERCEL_ENVIRONMENT: 'Preview', GITHUB_ENV: path.join(tmp, 'env'), GITHUB_OUTPUT: out,
  });
  srv.close();
  assert.strictEqual(r.code, 0, r.out);
  const o = fs.readFileSync(out, 'utf8');
  assert.match(o, /^deployment_state=READY$/m);
  assert.match(o, /^deployment_url=https:\/\/dpl\.example$/m);
  assert.match(o, new RegExp(`^deployment_sha=${SHA}$`, 'm'));
});

test('CLI：網站仍顯示 9 月 → GITHUB_ENV 記錄 site_verification_failed 與預期/實際月份，Email 主旨為「網站驗收失敗」', async () => {
  const srv = await startServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/data/release_metadata.json') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(OLD_META)); }
    res.end(page(2026, 9));
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd2-'));
  const envFile = path.join(tmp, 'env'); fs.writeFileSync(envFile, '');
  const r = await runNode('scripts/verify_remote.js', {
    BASE_URL: `http://127.0.0.1:${srv.address().port}`, EXPECTED_YEAR: '2026', EXPECTED_MONTH: '10', EXPECTED_SHA: SHA,
    VERIFY_FRESHNESS_TIMEOUT_SECONDS: '0.5', VERIFY_POLL_INTERVAL_SECONDS: '0.2', GITHUB_ENV: envFile,
  });
  srv.close();
  assert.strictEqual(r.code, 1, r.out);
  const envText = fs.readFileSync(envFile, 'utf8');
  assert.match(envText, /^FAILURE_TYPE=site_verification_failed$/m);
  assert.match(envText, /^EXPECTED_SITE_MONTH=2026\/10$/m);
  assert.match(envText, /^ACTUAL_SITE_MONTH=2026\/09$/m);
  const mail = emailDryRun(envFile, { DEPLOYMENT_STATE: 'READY' });
  assert.match(mail, /Subject: \[FlightData2\] 2026\/10 Staging 網站驗收失敗/);
  assert.match(mail, /這不是資料更新失敗/);
  assert.match(mail, /網站實際月份/);
});

test('Email：未設定 FAILURE_TYPE 時維持原本「自動更新失敗」主旨（向下相容）', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd2-'));
  const envFile = path.join(tmp, 'env'); fs.writeFileSync(envFile, '');
  const mail = emailDryRun(envFile);
  assert.match(mail, /Subject: \[FlightData2\] 自動更新失敗 ❌/);
});


// ===================== Review round 2: additional boundary tests =====================
// All GitHub/Vercel states below are MOCKED; the worktree tests use real git against a local file:// remote.

function scriptedGithub(script) {
  // script(url, callIndex) -> resp
  let i = 0;
  return async url => script(url, i++);
}

test('R1. 同一 SHA 多筆 deployment：Production 環境 success、舊 Preview success、新 Preview 進行中 → 繼續等待，最後採用最新 Preview 的 URL', async () => {
  const clock = fakeClock();
  const deps = [
    { id: 1, sha: SHA, environment: 'Production', creator: { login: 'vercel[bot]' }, created_at: '2026-11-25T13:46:30Z' },
    { id: 2, sha: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' }, created_at: '2026-11-25T13:46:04Z' },
    { id: 3, sha: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' }, created_at: '2026-11-25T13:50:00Z' },
  ];
  const fetchImpl = async url => {
    if (url.includes('/deployments?sha=')) return resp(200, deps);
    if (url.includes('/deployments/1/statuses')) return resp(200, [{ id: 10, state: 'success', created_at: '1', environment_url: 'https://prod.example' }]);
    if (url.includes('/deployments/2/statuses')) return resp(200, [{ id: 20, state: 'success', created_at: '1', environment_url: 'https://old-preview.example' }]);
    if (url.includes('/deployments/3/statuses')) {
      return resp(200, [{ id: 30, state: clock.now() >= 40000 ? 'success' : 'in_progress', created_at: '2', environment_url: 'https://new-preview.example' }]);
    }
    return resp(200, []);
  };
  const r = await waitForVercelDeployment({ repo: REPO, sha: SHA, environment: 'Preview', fetchImpl, sleep: clock.sleep, now: clock.now, log: () => {} });
  assert.strictEqual(r.deploymentId, 3);
  assert.strictEqual(r.deploymentUrl, 'https://new-preview.example');
  assert.ok(clock.now() >= 40000, 'must not accept the older success while the newest deployment is in progress');
});

test('R2. deployment statuses 回傳順序不可依賴：[舊 success, 新 in_progress]（由舊到新）→ 不可判定 READY', async () => {
  const clock = fakeClock();
  const fetchImpl = async url => {
    if (url.includes('/deployments?sha=')) return resp(200, [{ id: 9, sha: SHA, environment: 'Preview', creator: { login: 'vercel[bot]' }, created_at: '1' }]);
    if (url.includes('/deployments/9/statuses')) return resp(200, [
      { id: 100, state: 'success', created_at: '2026-11-25T13:46:05Z', environment_url: 'https://a.example' },
      { id: 101, state: 'in_progress', created_at: '2026-11-25T13:47:00Z' },
    ]);
    return resp(200, []);
  };
  await assert.rejects(
    waitForVercelDeployment({ repo: REPO, sha: SHA, environment: 'Preview', timeoutMs: 30000, fetchImpl, sleep: clock.sleep, now: clock.now, log: () => {} }),
    e => e.code === 'DEPLOYMENT_TIMEOUT' && e.details.state === 'in_progress');
});

test('R3. GitHub API 暫時 5xx 兩次後恢復 → 重試，不誤判部署失敗', async () => {
  const clock = fakeClock();
  const base = mockGithub(clock, { readyAt: 0 });
  let n = 0;
  const fetchImpl = async (url, o) => (n++ < 2 ? resp(502, { message: 'bad gateway' }) : base(url, o));
  const logs = [];
  const r = await waitForVercelDeployment({ repo: REPO, sha: SHA, environment: 'Preview', fetchImpl, sleep: clock.sleep, now: clock.now, log: m => logs.push(m) });
  assert.strictEqual(r.state, 'READY');
  assert.ok(logs.some(l => /transient error: .*HTTP 502/.test(l)));
});

test('R4. 網路錯誤（fetch reject）→ 視為暫時性，持續輪詢直到逾時，分類為部署逾時而非部署失敗', async () => {
  const clock = fakeClock();
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(
    waitForVercelDeployment({ repo: REPO, sha: SHA, timeoutMs: 60000, fetchImpl, sleep: clock.sleep, now: clock.now, log: () => {} }),
    e => e.code === 'DEPLOYMENT_TIMEOUT');
  assert.ok(clock.now() >= 60000 && clock.now() <= 70000);
});

test('R5. 逾時／間隔設定為非數字（NaN）→ 立即報錯，不會無限輪詢', async () => {
  await assert.rejects(waitForVercelDeployment({ repo: REPO, sha: SHA, timeoutMs: NaN, fetchImpl: async () => resp(200, []) }), /timeoutMs must be a positive number/);
  await assert.rejects(waitForVercelDeployment({ repo: REPO, sha: SHA, intervalMs: 0, fetchImpl: async () => resp(200, []) }), /intervalMs must be a positive number/);
  await assert.rejects(verifyRemote({ baseUrl: 'https://s.example', expectedYear: 2026, expectedMonth: 10, checks: CHECKS, freshnessTimeoutMs: NaN }), /freshnessTimeoutMs must be a positive number/);
});

test('R6. GitHub API 請求卡住不回應 → 單一請求會被中止，整體逾時仍有效（真實時鐘）', async () => {
  // A truly stalled request: only an AbortSignal can end it (no signal => hangs forever).
  const hang = (url, opts) => new Promise((_, reject) => {
    if (opts && opts.signal) opts.signal.addEventListener('abort', () => reject(opts.signal.reason));
  });
  const keepAlive = setInterval(() => {}, 1000);
  const guard = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('still running after 3s: request timeout not enforced')), 3000))]);
  const t0 = Date.now();
  await assert.rejects(
    guard(waitForVercelDeployment({ repo: REPO, sha: SHA, timeoutMs: 300, intervalMs: 50, fetchImpl: hang, log: () => {} })),
    e => e.code === 'DEPLOYMENT_TIMEOUT').finally(() => clearInterval(keepAlive));
  assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0}ms`);
});

test('R7. 網站請求卡住不回應 → 單一請求被中止，以 HTTP 錯誤結束（真實時鐘）', async () => {
  // A truly stalled request: only an AbortSignal can end it (no signal => hangs forever).
  const hang = (url, opts) => new Promise((_, reject) => {
    if (opts && opts.signal) opts.signal.addEventListener('abort', () => reject(opts.signal.reason));
  });
  const keepAlive = setInterval(() => {}, 1000);
  const guard = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('still running after 3s: request timeout not enforced')), 3000))]);
  const t0 = Date.now();
  await assert.rejects(
    guard(verifyRemote({ baseUrl: 'https://s.example', expectedYear: 2026, expectedMonth: 10, checks: CHECKS, requestTimeoutMs: 100,
      httpAttempts: 2, httpRetryDelayMs: 10, fetchImpl: hang, log: () => {} })),
    e => e.code === 'SITE_HTTP_ERROR').finally(() => clearInterval(keepAlive));
  assert.ok(Date.now() - t0 < 3000, `took ${Date.now() - t0}ms`);
});

test('R8. immutable deployment URL 為新版，但 staging alias 仍是舊版 → 不得通過', async () => {
  const clock = fakeClock();
  const newSite = mockSite(clock, { newAt: 0 });
  const oldSite = mockSite(clock, { newAt: null });
  const fetchImpl = (url, o) => (url.startsWith('https://dpl.example') ? newSite(url, o) : oldSite(url, o));
  const logs = [];
  await assert.rejects(
    verifyRemote({ baseUrl: 'https://alias.example', deploymentUrl: 'https://dpl.example', expectedYear: 2026, expectedMonth: 10, checks: CHECKS,
      expectedMetadata: NEW_META, freshnessTimeoutMs: 60000, intervalMs: 10000, fetchImpl, sleep: clock.sleep, now: clock.now, log: m => logs.push(m) }),
    e => e.code === 'SITE_STALE' && /site release_metadata.json shows 2026-09/.test(e.message));
  assert.ok(logs.some(l => l.startsWith('OK deployment /data/release_metadata.json -> 2026-10')), 'deployment URL itself was fine');
});

test('R9. immutable deployment URL 指紋不同（例如指到別的 build）→ 不得通過', async () => {
  const clock = fakeClock();
  const other = mockSite(clock, { newAt: 0, metaOverride: { ...NEW_META, generated_at: '2026-11-24T00:00:00.000Z' } });
  const good = mockSite(clock, { newAt: 0 });
  const fetchImpl = (url, o) => (url.startsWith('https://dpl.example') ? other(url, o) : good(url, o));
  await assert.rejects(
    verifyRemote({ baseUrl: 'https://alias.example', deploymentUrl: 'https://dpl.example', expectedYear: 2026, expectedMonth: 10, checks: CHECKS,
      expectedMetadata: NEW_META, freshnessTimeoutMs: 30000, fetchImpl, sleep: clock.sleep, now: clock.now, log: () => {} }),
    e => e.code === 'SITE_STALE' && /deployment release_metadata.json generated_at/.test(e.message));
});

test('R10. 正式站舊版參數（只有 BASE_URL/EXPECTED_YEAR/EXPECTED_MONTH）+ 正式站 metadata status 為 "staging" → 仍通過（CLI，向下相容）', async () => {
  const { maxMonth } = require('../scripts/verify_remote');
  const fileMonth = rel => maxMonth(JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')));
  const routes = {
    '/': fileMonth('data/flight_data_all.json'),
    ...Object.fromEntries(['tpe', 'khh', 'tsa', 'rmq', 'tnn', 'hun'].map(c => [`/airport/${c}/`, fileMonth(`data/flight_data_airport-${c}.json`)])),
    ...Object.fromEntries(['cal', 'eva', 'starlux', 'tiger'].map(c => [`/airline/${c}/`, fileMonth(`data/flight_data_airline-${c}.json`)])),
  };
  const latest = routes['/'];
  const m2 = String(latest.month).padStart(2, '0');
  const report = `/insights/${latest.year}-${m2}-taiwan-aviation-monthly-report/`;
  const srv = await startServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/data/release_metadata.json') return res.end(JSON.stringify({ latest_year: latest.year, latest_month: latest.month, status: 'staging', generated_at: 'whatever' }));
    if (routes[p]) return res.end(page(routes[p].year, routes[p].month));
    if (p === report) return res.end(`${latest.year} 年 ${latest.month} 月台灣航空月報`);
    if (p === '/sitemap.xml') return res.end(report);
    if (p === '/data/flight_data_all.json') return res.end(JSON.stringify([{ year: latest.year, month: latest.month }]));
    res.statusCode = 404; res.end();
  });
  const r = await runNode('scripts/verify_remote.js', {
    BASE_URL: `http://127.0.0.1:${srv.address().port}`, EXPECTED_YEAR: String(latest.year), EXPECTED_MONTH: String(latest.month),
  });
  srv.close();
  assert.strictEqual(r.code, 0, r.out);
  assert.match(r.out, /Website verification passed after 1 attempt/);
});

// ---------- pending-path git worktree: run the EXACT `run:` block from the workflow ----------
function extractRunBlock(stepName) {
  const lines = fs.readFileSync(path.join(ROOT, '.github/workflows/auto-update.yml'), 'utf8').split('\n');
  const start = lines.findIndex(l => l.trim() === `- name: ${stepName}`);
  assert.ok(start >= 0, `step not found: ${stepName}`);
  const runIdx = lines.findIndex((l, i) => i > start && l.trim() === 'run: |');
  const out = [];
  let indent = null;
  for (let i = runIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '') { out.push(''); continue; }
    const ind = l.match(/^ */)[0].length;
    if (indent === null) indent = ind;
    if (ind < indent) break;
    out.push(l.slice(indent));
  }
  return out.join('\n');
}

function sh(cmd, cwd) {
  const r = spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `${cmd}\n${r.stderr}`);
  return r.stdout.trim();
}

function makeShallowFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd2-wt-'));
  const remote = path.join(tmp, 'remote.git');
  const src = path.join(tmp, 'src');
  sh(`git init -q --bare "${remote}"`, tmp);
  // Mimic GitHub, which allows fetching a reachable commit by SHA.
  sh(`git -C "${remote}" config uploadpack.allowReachableSHA1InWant true`, tmp);
  sh(`git init -q -b main "${src}"`, tmp);
  const g = c => sh(`git -c user.name=t -c user.email=t@example.com ${c}`, src);
  fs.mkdirSync(path.join(src, 'data'));
  fs.writeFileSync(path.join(src, 'data/release_metadata.json'), JSON.stringify({ latest_year: 2026, latest_month: 9, status: 'production' }));
  g('add -A'); g('commit -q -m main-sept');
  g('checkout -q -b staging');
  fs.writeFileSync(path.join(src, 'data/release_metadata.json'), JSON.stringify({ latest_year: 2026, latest_month: 10, status: 'staging' }));
  g('add -A'); g('commit -q -m staging-oct');
  const stagingSha = sh('git rev-parse HEAD', src);
  g(`remote add origin "${remote}"`); g('push -q origin main staging');
  const ws = path.join(tmp, 'ws');
  sh(`git clone -q --depth 1 --branch main "file://${remote}" "${ws}"`, tmp);
  const bin = path.join(tmp, 'bin');
  fs.mkdirSync(bin);
  const record = path.join(tmp, 'node-called.json');
  // Stub `node`: record what verify_remote.js would read (RELEASE_ROOT HEAD + metadata month), exit with STUB_EXIT.
  fs.writeFileSync(path.join(bin, 'node'), `#!/bin/bash
printf '{"root":"%s","head":"%s","meta":%s}' "$RELEASE_ROOT" "$(git -C "$RELEASE_ROOT" rev-parse HEAD)" "$(cat "$RELEASE_ROOT/data/release_metadata.json")" > "${record}"
exit "\${STUB_EXIT:-0}"
`, { mode: 0o755 });
  return { tmp, ws, bin, record, stagingSha, runnerTemp: path.join(tmp, 'runner_temp') };
}

function runPendingStep(fx, { expectedSha, extraPath = '', stubExit = 0 }) {
  fs.mkdirSync(fx.runnerTemp, { recursive: true });
  const script = extractRunBlock('Verify pending staging site');
  const r = spawnSync('bash', ['-e', '-c', script], {
    cwd: fx.ws, encoding: 'utf8',
    env: { PATH: `${extraPath}${fx.bin}:${process.env.PATH}`, EXPECTED_SHA: expectedSha, RUNNER_TEMP: fx.runnerTemp,
      GITHUB_ENV: path.join(fx.tmp, 'github_env'), STUB_EXIT: String(stubExit), HOME: process.env.HOME },
  });
  const worktrees = sh('git worktree list --porcelain', fx.ws);
  return { ...r, worktrees, nodeCalled: fs.existsSync(fx.record) ? JSON.parse(fs.readFileSync(fx.record, 'utf8')) : null };
}

test('W1. 淺層 checkout（--depth 1，只有 main）中 pending SHA 不存在 → 自動 fetch 指定 SHA，驗收讀 staging commit 的資料，結束後清除 worktree', async () => {
  const fx = makeShallowFixture();
  assert.strictEqual(sh('git rev-parse --is-shallow-repository', fx.ws), 'true');
  assert.notStrictEqual(spawnSync('git', ['cat-file', '-e', `${fx.stagingSha}^{commit}`], { cwd: fx.ws }).status, 0, 'precondition: SHA absent');
  const r = runPendingStep(fx, { expectedSha: fx.stagingSha });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.nodeCalled.head, fx.stagingSha);
  assert.strictEqual(r.nodeCalled.meta.latest_month, 10, 'must read staging data, not main (9)');
  assert.ok(!r.worktrees.includes('staging-release'), 'worktree must be cleaned up');
});

test('W2. worktree HEAD 與預期 SHA 不符 → 立即失敗，不執行驗收', async () => {
  const fx = makeShallowFixture();
  const realGit = sh('command -v git', fx.tmp);
  const lie = path.join(fx.tmp, 'liegit');
  fs.mkdirSync(lie);
  fs.writeFileSync(path.join(lie, 'git'), `#!/bin/bash
if [ "$1" = "-C" ] && [ "$3" = "rev-parse" ] && [ "$4" = "HEAD" ]; then echo 0000000000000000000000000000000000000000; exit 0; fi
exec "${realGit}" "$@"
`, { mode: 0o755 });
  const r = runPendingStep(fx, { expectedSha: fx.stagingSha, extraPath: `${lie}:` });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stdout, /Staging worktree mismatch/);
  assert.strictEqual(r.nodeCalled, null, 'verification must not run');
  assert.ok(!r.worktrees.includes('staging-release'));
});

test('W3. pending SHA 在遠端不存在 → fetch 失敗即停止，不會退回使用 main 的資料', async () => {
  const fx = makeShallowFixture();
  const r = runPendingStep(fx, { expectedSha: '1234567890123456789012345678901234567890' });
  assert.notStrictEqual(r.status, 0);
  assert.strictEqual(r.nodeCalled, null);
});

test('W4. pending SHA 為短 SHA 或空字串 → 立即失敗', async () => {
  const fx = makeShallowFixture();
  for (const bad of [fx.stagingSha.slice(0, 7), '']) {
    const r = runPendingStep(fx, { expectedSha: bad });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stdout, /Invalid pending staging SHA/);
    assert.strictEqual(r.nodeCalled, null);
  }
});

test('W5. 網站驗收失敗時 → step 結束碼保持失敗（trap 不會吞掉），worktree 仍被清除', async () => {
  const fx = makeShallowFixture();
  const r = runPendingStep(fx, { expectedSha: fx.stagingSha, stubExit: 1 });
  assert.strictEqual(r.status, 1);
  assert.ok(r.nodeCalled);
  assert.ok(!r.worktrees.includes('staging-release'));
});

let finished = false;
process.on('exit', code => {
  if (!finished && code === 0) { console.log('\nFAIL test runner exited before all tests completed'); process.exitCode = 1; }
});
(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`PASS ${t.name}`); }
    catch (e) { failed += 1; console.log(`FAIL ${t.name}\n     ${e.stack.split('\n').slice(0, 3).join('\n     ')}`); }
  }
  finished = true;
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
