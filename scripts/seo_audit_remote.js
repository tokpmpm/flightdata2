#!/usr/bin/env node
/**
 * Technical SEO audit of the LIVE site (read-only, no dependencies).
 *
 * Used by the weekly SEO loop (.claude/skills/seo-weekly-review). It only sends GET requests
 * to public URLs; it never changes anything.
 *
 * Checks:
 *   - sitemap.xml: every <loc> returns 200, has a <title>, meta description, a self-referencing
 *     canonical, no noindex, parseable JSON-LD, and exactly one <h1>
 *   - duplicate titles / descriptions across sitemap pages
 *   - robots.txt points at the sitemap; /favicon.ico exists
 *   - internal/dev files that must NOT be public return 404 (leak check)
 *
 * Usage:
 *   node scripts/seo_audit_remote.js                       # markdown report to stdout
 *   node scripts/seo_audit_remote.js --json out.json       # also write a JSON snapshot
 *   BASE_URL=https://staging.example.com node scripts/seo_audit_remote.js
 *
 * Exit code: 1 if any check FAILs (WARNs do not fail), so it can gate CI later if wanted.
 */

const fs = require('fs');

const BASE_URL = (process.env.BASE_URL || 'https://flightdata2.meshthings.com').replace(/\/$/, '');
const TIMEOUT_MS = 20000;

// Paths that are internal tools / dev files and should never be served publicly.
const LEAK_PATHS = [
  '/build.js',
  '/prerender.js',
  '/process_data.js',
  '/analyze_data.py',
  '/package.json',
  '/CHANGELOG.md',
  '/README.md',
  '/SEO-AEO-GEO-分析報告.md',
  '/.env',
  '/.env.example',
  '/.github/workflows/auto-update.yml',
  '/scripts/send_update_email.py',
  '/seo/experiments.csv',
  '/.claude/skills/seo-weekly-review/SKILL.md',
];

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'flightdata2-seo-audit/1.0', 'Cache-Control': 'no-cache' },
    });
    const body = res.status === 200 ? await res.text() : '';
    return { status: res.status, location: res.headers.get('location'), body, ms: Date.now() - started };
  } catch (e) {
    return { status: 0, error: e.message, body: '', ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? '') : null;
}

function findTag(html, re) {
  return (html.match(re) || [])[0] || null;
}

function analyzePage(url, html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const descTag = findTag(html, /<meta[^>]+name=["']description["'][^>]*>/i);
  const canonTag = findTag(html, /<link[^>]+rel=["']canonical["'][^>]*>/i);
  const robotsTag = findTag(html, /<meta[^>]+name=["']robots["'][^>]*>/i);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const ldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const ldTypes = [];
  let ldErrors = 0;
  for (const b of ldBlocks) {
    try {
      const data = JSON.parse(b[1]);
      const items = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const it of items) if (it && it['@type']) ldTypes.push([].concat(it['@type']).join('/'));
    } catch {
      ldErrors++;
    }
  }
  return {
    url,
    title: title ? decode(title) : null,
    description: descTag ? attr(descTag, 'content') : null,
    canonical: canonTag ? attr(canonTag, 'href') : null,
    robots: robotsTag ? attr(robotsTag, 'content') : null,
    h1Count,
    ldTypes: [...new Set(ldTypes)],
    ldErrors,
    bytes: Buffer.byteLength(html),
  };
}

async function main() {
  const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
  const results = []; // { level: 'FAIL'|'WARN'|'OK', check, detail }
  const add = (level, check, detail = '') => results.push({ level, check, detail });

  // robots.txt + sitemap
  const robots = await get(`${BASE_URL}/robots.txt`);
  if (robots.status !== 200) add('FAIL', 'robots.txt', `HTTP ${robots.status}`);
  else if (!/sitemap:/i.test(robots.body)) add('WARN', 'robots.txt', '沒有 Sitemap: 行');
  else add('OK', 'robots.txt', '有 Sitemap: 行');

  const sm = await get(`${BASE_URL}/sitemap.xml`);
  if (sm.status !== 200) {
    add('FAIL', 'sitemap.xml', `HTTP ${sm.status}`);
  }
  const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  add(locs.length ? 'OK' : 'FAIL', 'sitemap.xml', `${locs.length} 個 URL`);

  const fav = await get(`${BASE_URL}/favicon.ico`);
  add(fav.status === 200 ? 'OK' : 'WARN', '/favicon.ico', `HTTP ${fav.status}`);

  // pages
  const pages = [];
  for (const url of locs) {
    const r = await get(url);
    if (r.status !== 200) {
      add('FAIL', `頁面 ${url}`, `HTTP ${r.status}${r.location ? ` → ${r.location}` : ''}${r.error ? ` (${r.error})` : ''}`);
      continue;
    }
    const p = { ...analyzePage(url, r.body), ms: r.ms };
    pages.push(p);
    const issues = [];
    if (!p.title) issues.push(['FAIL', '缺 <title>']);
    if (!p.description) issues.push(['WARN', '缺 meta description']);
    if (!p.canonical) issues.push(['WARN', '缺 canonical']);
    else if (p.canonical.replace(/\/$/, '') !== url.replace(/\/$/, '')) issues.push(['WARN', `canonical 指向 ${p.canonical}`]);
    if (p.robots && /noindex/i.test(p.robots)) issues.push(['FAIL', `sitemap 頁面含 noindex (${p.robots})`]);
    if (p.ldErrors) issues.push(['FAIL', `${p.ldErrors} 個 JSON-LD 無法解析`]);
    if (p.h1Count !== 1) issues.push(['WARN', `h1 數量 ${p.h1Count}`]);
    if (p.bytes > 500 * 1024) issues.push(['WARN', `HTML ${(p.bytes / 1024).toFixed(0)} KB`]);
    for (const [lvl, msg] of issues) add(lvl, `頁面 ${url}`, msg);
  }

  // duplicates
  for (const field of ['title', 'description']) {
    const seen = new Map();
    for (const p of pages) if (p[field]) seen.set(p[field], [...(seen.get(p[field]) || []), p.url]);
    for (const [val, urls] of seen) if (urls.length > 1) add('WARN', `重複 ${field}`, `${urls.length} 頁：「${val.slice(0, 40)}…」`);
  }

  // leak check
  for (const p of LEAK_PATHS) {
    const r = await get(`${BASE_URL}${encodeURI(p)}`);
    if (r.status === 200) add('FAIL', `外洩檢查 ${p}`, 'HTTP 200（不應公開）');
  }
  add('OK', '外洩檢查', `已檢查 ${LEAK_PATHS.length} 個路徑`);

  // report
  const now = new Date().toISOString();
  const counts = { FAIL: 0, WARN: 0, OK: 0 };
  results.forEach((r) => counts[r.level]++);
  const lines = [];
  lines.push(`### 技術稽核（${BASE_URL}，${now}）`);
  lines.push('');
  lines.push(`來源：\`node scripts/seo_audit_remote.js\` 實際抓取正式站。FAIL ${counts.FAIL}／WARN ${counts.WARN}／OK ${counts.OK}`);
  lines.push('');
  const notOk = results.filter((r) => r.level !== 'OK');
  if (notOk.length) {
    lines.push('| 等級 | 項目 | 說明 |', '|---|---|---|');
    for (const r of notOk) lines.push(`| ${r.level} | ${r.check} | ${r.detail} |`);
  } else {
    lines.push('全部通過。');
  }
  lines.push('');
  lines.push('<details><summary>各頁 title／canonical／JSON-LD</summary>', '');
  lines.push('| URL | title | canonical 自指 | JSON-LD | KB | ms |', '|---|---|---|---|---|---|');
  for (const p of pages) {
    const path = p.url.replace(BASE_URL, '') || '/';
    const selfCanon = p.canonical && p.canonical.replace(/\/$/, '') === p.url.replace(/\/$/, '') ? '是' : '否';
    lines.push(`| ${path} | ${(p.title || '').replace(/\|/g, '｜')} | ${selfCanon} | ${p.ldTypes.join(', ')} | ${(p.bytes / 1024).toFixed(0)} | ${p.ms} |`);
  }
  lines.push('', '</details>');
  console.log(lines.join('\n'));

  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ baseUrl: BASE_URL, at: now, results, pages }, null, 2));
  process.exit(counts.FAIL ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
