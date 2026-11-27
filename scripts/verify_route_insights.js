// Verifies the prerendered route rankings, holiday preview and GA coverage of /insights/.
// Recomputes the rankings straight from data/flight_data_all.json (independent of scripts/route_insights.js).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GA_ID = 'G-ZS0NCFZ2K3';
const MIN_FLIGHTS = 30;
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'flight_data_all.json'), 'utf8'));
const holidays = fs.existsSync(path.join(ROOT, 'data', 'holiday_previews.json'))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'holiday_previews.json'), 'utf8')) : [];

let checks = 0, failures = 0;
function check(ok, label) {
  checks += 1;
  if (ok) console.log('✅ ' + label);
  else { failures += 1; console.error('❌ ' + label); }
}
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 1. GA4 on every /insights/ page, exactly once.
const insightsRoot = path.join(ROOT, 'insights');
const insightFiles = ['insights/index.html'].concat(
  fs.readdirSync(insightsRoot)
    .filter(d => fs.existsSync(path.join(insightsRoot, d, 'index.html')))
    .map(d => 'insights/' + d + '/index.html'));
for (const f of insightFiles) {
  const n = (read(f).match(new RegExp('gtag/js\\?id=' + GA_ID, 'g')) || []).length;
  check(n === 1, f + ' 載入 GA4 ' + GA_ID + '（' + n + ' 次）');
}

// 2. Route rankings on home / airport / airline pages, numbers recomputed from raw rows.
const pages = [
  { file: 'index.html', filter: () => true },
  ...[['tpe', '桃園國際機場'], ['khh', '高雄國際機場'], ['tsa', '臺北松山機場'], ['rmq', '臺中清泉崗機場'], ['tnn', '臺南機場'], ['hun', '花蓮機場']]
    .map(([c, n]) => ({ file: 'airport/' + c + '/index.html', filter: r => r.airport === n })),
  ...[['cal', '中華'], ['eva', '長榮'], ['starlux', '星宇'], ['tiger', '台灣虎航']]
    .map(([c, n]) => ({ file: 'airline/' + c + '/index.html', filter: r => r.airline === n }))
];

function expectedRoutes(rows) {
  const key = rows.reduce((m, r) => Math.max(m, r.year * 100 + r.month), 0);
  const cur = rows.filter(r => r.year * 100 + r.month === key);
  const agg = {};
  for (const r of cur) {
    const k = r.airport + '|' + r.destination + '|' + r.airline;
    const a = agg[k] || (agg[k] = { f: 0, s: 0, p: 0 });
    a.f += r.flights; a.s += r.totalSeats; a.p += r.passengers;
  }
  const eligible = Object.values(agg).filter(a => a.f >= MIN_FLIGHTS && a.s).map(a => a.p / a.s * 100);
  eligible.sort((a, b) => a - b);
  return { ym: key, count: eligible.length, min: eligible[0], max: eligible[eligible.length - 1] };
}
function listValues(html, kind) {
  // Top 5 in the first <ol>, the rest inside <details class="rr-more"> — all prerendered.
  const m = html.match(new RegExp('<div class="rr-ranked" data-rank-list="' + kind + '">([\\s\\S]*?)</div><!-- /rr-ranked -->'));
  if (!m) return null;
  return [...m[1].matchAll(/data-lf="([\d.]+)" data-flights="(\d+)"/g)].map(x => ({ lf: Number(x[1]), flights: Number(x[2]) }));
}

for (const p of pages) {
  const html = read(p.file);
  check(html.includes('id="route-rankings"'), p.file + ' 有 #route-rankings 區塊');
  const rrPos = html.indexOf('id="route-rankings"'), tablePos = html.indexOf('<section class="table-section"'), dlPos = html.indexOf('id="download-section"');
  check(tablePos !== -1 && rrPos > tablePos && (dlPos === -1 || rrPos < dlPos), p.file + ' 排行區塊在資料表之後、下載區之前');
  check(html.includes('最新月份快照・不受上方篩選影響'), p.file + ' 排行標示「不受上方篩選影響」');
  const links = [...html.matchAll(/<a class="rr-link" href="([^"]+)" rel="nofollow" data-airport="([^"]*)" data-destination="([^"]+)"/g)];
  check(links.length > 0, p.file + ' 排行航線為可點擊連結（' + links.length + ' 個，rel=nofollow）');
  check(!/id="route-rankings"[^>]*data-nosnippet/.test(html), p.file + ' 排行區塊未加 data-nosnippet');
  const exp = expectedRoutes(data.filter(p.filter));
  const empt = listValues(html, 'emptiest'), full = listValues(html, 'fullest');
  if (exp.count < 3) {
    check(!empt && !full, p.file + ' 符合 ≥' + MIN_FLIGHTS + ' 班的航線少於 3 組（' + exp.count + '），不顯示排行');
    continue;
  }
  check(!!empt && !!full, p.file + ' 有最空與最滿清單');
  if (!empt || !full) continue;
  check(empt.length === Math.min(10, exp.count) && full.length === Math.min(10, exp.count), p.file + ' 清單筆數 = min(10, ' + exp.count + ')');
  const firstOl = html.match(/<div class="rr-ranked" data-rank-list="emptiest"><ol class="rr-list">([\s\S]*?)<\/ol>/);
  check(!!firstOl && (firstOl[1].match(/class="rr-item"/g) || []).length === Math.min(5, exp.count), p.file + ' 預設只顯示前 5 名，其餘收合在 <details>');
  check(empt.concat(full).every(x => x.flights >= MIN_FLIGHTS), p.file + ' 所有列出航線皆 ≥' + MIN_FLIGHTS + ' 班');
  check(Math.abs(empt[0].lf - Math.round(exp.min * 10) / 10) < 0.05, p.file + ' 最空第一名載客率 ' + empt[0].lf + '% = 重算 ' + exp.min.toFixed(1) + '%（' + exp.ym + '）');
  check(Math.abs(full[0].lf - Math.round(exp.max * 10) / 10) < 0.05, p.file + ' 最滿第一名載客率 ' + full[0].lf + '% = 重算 ' + exp.max.toFixed(1) + '%');
  check(empt.every((x, i) => i === 0 || x.lf >= empt[i - 1].lf), p.file + ' 最空清單由低到高');
  check(/"@type": "ItemList"/.test(html) && /哪條航線最空/.test(html), p.file + ' JSON-LD 含 ItemList 與「哪條航線最空」FAQ');
}

// 3. Holiday previews: page, sitemap, /insights/ index (as a feature, not a monthly report), homepage entry.
const sitemap = read('sitemap.xml');
const idx = read('insights/index.html');
const home = read('index.html');
const today = new Date().toISOString().slice(0, 10);
for (const h of holidays) {
  const rel = 'insights/' + h.slug + '/index.html';
  const exists = fs.existsSync(path.join(ROOT, rel));
  check(exists, rel + ' 存在');
  if (!exists) continue;
  const page = read(rel);
  check(page.includes('<link rel="canonical" href="https://flightdata2.meshthings.com/insights/' + h.slug + '/">'), h.slug + ' canonical 正確');
  check(/"@type":"FAQPage"/.test(page) && /"@type":"Article"/.test(page) && /"@type":"BreadcrumbList"/.test(page), h.slug + ' JSON-LD 含 Article / FAQPage / BreadcrumbList');
  check(sitemap.includes('<loc>https://flightdata2.meshthings.com/insights/' + h.slug + '/</loc>'), h.slug + ' 在 sitemap');
  const featureIdx = idx.indexOf('id="feature-title"');
  check(featureIdx !== -1 && idx.indexOf('href="/insights/' + h.slug + '/"') > featureIdx, h.slug + ' 列在 /insights/ 專題分析，而非月報');
  const shouldShow = today < h.holidayDate;
  check(home.includes('class="holiday-entry"') === shouldShow && (!shouldShow || home.includes('href="/insights/' + h.slug + '/"')),
    '首頁連假入口' + (shouldShow ? '顯示（' + h.holidayDate + ' 前）' : '已隱藏（已過 ' + h.holidayDate + '）'));
}

// 4. Latest monthly report links to the rankings instead of duplicating them.
const latestKey = data.reduce((m, r) => Math.max(m, r.year * 100 + r.month), 0);
const reportRel = 'insights/' + Math.floor(latestKey / 100) + '-' + String(latestKey % 100).padStart(2, '0') + '-taiwan-aviation-monthly-report/index.html';
const report = read(reportRel);
check(report.includes('id="route-ranking-links"') && report.includes('href="/#route-rankings"') && report.includes('href="/airport/tpe/#route-rankings"'), '最新月報有「本月航線排行在這裡看」連結區');
check(!report.includes('data-rank-list='), '最新月報沒有重複放完整排行');

console.log('\nRoute insights verification: ' + (checks - failures) + '/' + checks + ' checks passed.');
if (failures) process.exit(1);
