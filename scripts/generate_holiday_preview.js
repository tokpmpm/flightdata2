// Holiday preview pages, e.g. /insights/2027-cny-japan-flights/.
// CAA data lags 1–2 months, so a preview uses the same holiday period in past years.
// Driven by data/holiday_previews.json; one page per entry, rebuilt on every prerender.
const fs = require('fs');
const path = require('path');
const { GA_SNIPPET } = require('./ga.js');
const { countryOf, lfLevel, routeLabel, CAA_URL, MIN_FLIGHTS } = require('./route_insights.js');

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function ymLabel(ym) { const [y, m] = ym.split('-'); return y + '/' + m; }
function ymText(ym) { const [y, m] = ym.split('-'); return y + ' 年 ' + Number(m) + ' 月'; }
function lfOf(a) { return a && a.seats ? a.passengers / a.seats * 100 : null; }

function sumBy(rows, keyFn) {
  const out = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    let a = out.get(k);
    if (!a) { a = { flights: 0, seats: 0, passengers: 0, sample: r }; out.set(k, a); }
    a.flights += Number(r.flights || 0);
    a.seats += Number(r.totalSeats || r.seats || 0);
    a.passengers += Number(r.passengers || 0);
  }
  return out;
}

function loadHolidayConfigs(root) {
  const file = path.join(root, 'data', 'holiday_previews.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function computeHolidayPreview(records, cfg, destinationMap) {
  const rows = records.filter(r => countryOf(destinationMap, r.destination) === cfg.country);
  const holidayMonths = new Set(Object.values(cfg.pastHolidays || {}).map(d => d.slice(0, 7)));
  const byMonth = sumBy(rows, r => r.yearMonth);
  // Start the trend at January of the first compared year (earlier months include the 2022 border closure).
  const seriesStart = cfg.compareMonths.slice().sort()[0].slice(0, 4) + '-01';
  const series = [...byMonth.keys()].filter(ym => ym >= seriesStart).sort().map(ym => ({ ym, loadFactor: lfOf(byMonth.get(ym)), passengers: byMonth.get(ym).passengers, holiday: holidayMonths.has(ym) }));
  const compare = cfg.compareMonths.map(ym => ({ ym, loadFactor: byMonth.has(ym) ? lfOf(byMonth.get(ym)) : null, holiday: holidayMonths.has(ym) }));
  const lastYm = [...cfg.compareMonths].reverse().find(ym => byMonth.has(ym)) || cfg.compareMonths[cfg.compareMonths.length - 1];

  const lastRows = rows.filter(r => r.yearMonth === lastYm);
  const destLast = sumBy(lastRows, r => r.destination);
  const topDests = [...destLast.entries()].sort((a, b) => b[1].passengers - a[1].passengers).slice(0, 8).map(([d]) => d);
  const destByMonth = sumBy(rows.filter(r => cfg.compareMonths.includes(r.yearMonth)), r => r.destination + '|' + r.yearMonth);
  const destTable = topDests.map(d => ({ destination: d, values: cfg.compareMonths.map(ym => lfOf(destByMonth.get(d + '|' + ym))) }));

  const routeAgg = sumBy(lastRows, r => r.airport + '|' + r.destination + '|' + r.airline);
  const routes = [...routeAgg.values()].filter(a => a.flights >= MIN_FLIGHTS && a.seats).map(a => ({
    airport: a.sample.airport, destination: a.sample.destination, airline: a.sample.airline,
    flights: a.flights, seats: a.seats, passengers: a.passengers, loadFactor: a.passengers / a.seats * 100
  }));
  const easiest = [...routes].sort((a, b) => a.loadFactor - b.loadFactor).slice(0, 8);
  const busiestDest = destTable.reduce((best, d) => {
    const v = d.values[d.values.length - 1];
    return v != null && (!best || v > best.value) ? { destination: d.destination, value: v } : best;
  }, null);
  return { cfg, series, compare, lastYm, destTable, easiest, busiestDest, routeCount: routes.length };
}

function lineChartSvg(series, country) {
  if (series.length < 2) return '';
  const W = 900, H = 260, L = 44, R = 16, T = 20, B = 34;
  const vals = series.map(s => s.loadFactor);
  const min = Math.max(0, Math.floor((Math.min(...vals) - 2) / 5) * 5), max = 100;
  const x = i => L + i * (W - L - R) / (series.length - 1);
  const y = v => T + (max - v) * (H - T - B) / (max - min);
  let g = '';
  for (let v = min; v <= max; v += 5) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" class="grid"/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + v + '%</text>';
  series.forEach((s, i) => { if (s.ym.endsWith('-01')) g += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + s.ym.slice(0, 4) + '</text>'; });
  const pathD = series.map((s, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(s.loadFactor).toFixed(1)).join('');
  g += '<path d="' + pathD + 'L' + x(series.length - 1).toFixed(1) + ',' + y(min).toFixed(1) + 'L' + x(0).toFixed(1) + ',' + y(min).toFixed(1) + 'Z" class="area"/>';
  g += '<path d="' + pathD + '" class="line"/>';
  series.forEach((s, i) => {
    if (!s.holiday) return;
    g += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(s.loadFactor).toFixed(1) + '" r="5.5" class="dot"/><text x="' + x(i).toFixed(1) + '" y="' + (y(s.loadFactor) - 11).toFixed(1) + '" text-anchor="middle" class="lbl">' + s.loadFactor.toFixed(1) + '%</text>';
  });
  const last = series[series.length - 1];
  g += '<text x="' + x(series.length - 1).toFixed(1) + '" y="' + (y(last.loadFactor) + 18).toFixed(1) + '" text-anchor="end">' + ymLabel(last.ym) + ' ' + last.loadFactor.toFixed(1) + '%</text>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="台灣往返' + esc(country) + '航線各月載客率折線圖，紅點為春節所在月份">' + g + '</svg>';
}

function renderHolidayPage(p, opts) {
  const cfg = p.cfg, siteUrl = opts.siteUrl, buildDate = opts.buildDate, datePublished = opts.datePublished || buildDate;
  const canonical = siteUrl + '/insights/' + cfg.slug + '/';
  const country = cfg.country;
  const title = cfg.holidayName + '飛' + country + '會很滿嗎？三年數據看載客率';
  const holidayVals = p.compare.filter(c => c.holiday && c.loadFactor != null);
  const minH = holidayVals.length ? Math.min(...holidayVals.map(c => c.loadFactor)) : null;
  const lastC = p.compare.find(c => c.ym === p.lastYm);
  const desc = '用交通部民航局 ' + p.cfg.compareMonths.map(ymLabel).join('、') + ' 數據，看' + cfg.holidayName + '前後台灣往返' + country + '航線有多滿：' + ymText(p.lastYm) + '平均載客率 ' + (lastC && lastC.loadFactor != null ? lastC.loadFactor.toFixed(1) + '%' : '—') + '，並列出相對好訂的航線與航空公司。';
  const e0 = p.easiest[0];
  const faq = [
    { q: cfg.holidayName + '飛' + country + '機位會很滿嗎？', a: '過去幾年春節所在月份，台灣往返' + country + '的平均載客率' + (minH != null ? '都在 ' + Math.floor(minH) + '% 以上' : '偏高') + '；' + ymText(p.lastYm) + '為 ' + (lastC && lastC.loadFactor != null ? lastC.loadFactor.toFixed(1) + '%' : '—') + (p.busiestDest ? '，其中' + p.busiestDest.destination + '達 ' + p.busiestDest.value.toFixed(1) + '%' : '') + '。' },
    { q: cfg.holidayName + '飛' + country + '哪家航空比較好訂？', a: e0 ? ymText(p.lastYm) + country + '線當月至少 ' + MIN_FLIGHTS + ' 班的 ' + p.routeCount + ' 組航線中，' + routeLabel(e0) + '（' + e0.airline + '）載客率 ' + e0.loadFactor.toFixed(1) + '% 最低，相對好訂。實際仍以出發日與票價為準。' : '資料不足。' },
    { q: '為什麼不用今年的資料？', a: '民航局統計約晚 1 到 2 個月公布，' + cfg.holidayName + '前還看不到當月數字，所以用往年同一時期當參考。' }
  ];
  const schemas = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, datePublished, dateModified: buildDate, inLanguage: 'zh-Hant-TW', mainEntityOfPage: canonical, citation: CAA_URL, author: { '@type': 'Organization', name: 'MeshThings FlightData' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: siteUrl + '/' },
      { '@type': 'ListItem', position: 2, name: '月報與洞察', item: siteUrl + '/insights/' },
      { '@type': 'ListItem', position: 3, name: title, item: canonical }] }
  ];
  const holidayNote = Object.entries(cfg.pastHolidays || {}).map(([y, d]) => y + ' 年 ' + Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10))).join('、');
  const css = ':root{--bg:#f6ecd8;--paper:#fffaf1;--soft:#fcf4e7;--line:#dec7a2;--text:#3b2b20;--muted:#7c6654;--accent:#c67c4d;--full:#b4452f;--busy:#c9772f;--easy:#4f8a6b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;line-height:1.75}a{color:#8e4f2c}.wrap{max-width:980px;margin:auto;padding:0 20px}.nav{background:#fbf5ea;border-bottom:1px solid var(--line)}.navin{max-width:980px;margin:auto;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:10px;font-weight:900;color:#4a3427;text-decoration:none}.logo{width:40px;height:40px;border-radius:13px;background:var(--accent);color:#fff;display:grid;place-items:center}.navlinks{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-weight:800}.navlinks a{text-decoration:none}h1{font-size:clamp(30px,5vw,46px);line-height:1.15;margin:40px 0 12px;text-wrap:balance}h2{font-size:clamp(21px,3vw,27px);margin:36px 0 12px}.lead{font-size:17px;max-width:68ch}.muted{color:var(--muted);font-size:13px}.card{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:20px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.stat.hol{border-color:var(--full)}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid2>*{min-width:0}.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px;min-width:460px;font-variant-numeric:tabular-nums}th,td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{font-size:12px;color:var(--muted)}td.full{color:var(--full);font-weight:800}td.busy{color:var(--busy);font-weight:700}ol.easy{margin:0;padding-left:22px;display:grid;gap:8px}ol.easy small{color:var(--muted);margin-left:6px}svg{width:100%;height:auto;display:block}svg text{font-size:11px;fill:var(--muted);font-variant-numeric:tabular-nums}svg .lbl{fill:var(--text);font-weight:700}svg .grid{stroke:var(--line);stroke-width:1}svg .area{fill:var(--accent);fill-opacity:.12}svg .line{fill:none;stroke:var(--accent);stroke-width:2.5}svg .dot{fill:var(--full)}.faq details{padding:12px 0;border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-weight:800}.links{display:flex;flex-wrap:wrap;gap:10px 18px}.foot{margin-top:44px;padding:20px 0;border-top:1px solid #d5bc95;font-size:12px;color:#77604e}@media(max-width:760px){.stats{grid-template-columns:1fr 1fr}.grid2{grid-template-columns:1fr}}';

  let html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  html += '<title>' + esc(title) + '</title><meta name="description" content="' + esc(desc) + '"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="' + canonical + '">';
  html += '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '"><meta property="og:type" content="article"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="' + siteUrl + '/og-card.png"><meta property="og:locale" content="zh_TW"><meta name="twitter:card" content="summary_large_image">';
  html += GA_SNIPPET;
  html += schemas.map(s => '<script type="application/ld+json">' + JSON.stringify(s) + '</script>').join('') + '<style>' + css + '</style></head><body>';
  html += '<header class="nav"><nav class="navin" aria-label="主要導航"><a class="brand" href="/"><span class="logo">✈</span><span>台灣航空數據月報</span></a><div class="navlinks"><a href="/">首頁</a><a href="/#route-rankings">本月航線排行</a><a href="/insights/">全部月報</a><a href="/about/">方法論</a></div></nav></header>';
  html += '<main class="wrap"><article><h1>' + esc(title) + '</h1>';
  html += '<p class="lead">' + esc(cfg.holidayName) + '是 ' + Number(cfg.holidayDate.slice(5, 7)) + '/' + Number(cfg.holidayDate.slice(8, 10)) + '。民航局統計晚 1 到 2 個月才公布，所以這裡用往年春節月份（' + esc(holidayNote) + '）的實際數據，看台灣往返' + esc(country) + '的航線有多滿、哪些相對好訂。</p>';
  html += '<section aria-labelledby="h-stats"><h2 id="h-stats">往年同期，' + esc(country) + '線平均載客率</h2><div class="stats">' + p.compare.map(c => '<div class="card stat' + (c.holiday ? ' hol' : '') + '"><span class="muted">' + ymText(c.ym) + (c.holiday ? '（春節月）' : '') + '</span><b>' + (c.loadFactor == null ? '—' : c.loadFactor.toFixed(1) + '%') + '</b></div>').join('') + '</div></section>';
  html += '<section class="card" aria-labelledby="h-trend" style="margin-top:20px"><h2 id="h-trend" style="margin-top:0">台灣往返' + esc(country) + '，每月載客率</h2><p class="muted">' + ymLabel(p.series[0].ym) + '–' + ymLabel(p.series[p.series.length - 1].ym) + '，紅點為春節所在月份</p>' + lineChartSvg(p.series, country) + '</section>';
  html += '<div class="grid2" style="margin-top:14px">';
  html += '<section class="card" aria-labelledby="h-dest"><h2 id="h-dest" style="margin-top:0;font-size:19px">熱門' + esc(country) + '目的地：春節月份載客率</h2><div class="tw"><table><thead><tr><th scope="col">目的地</th>' + cfg.compareMonths.map(ym => '<th scope="col">' + ymLabel(ym) + '</th>').join('') + '</tr></thead><tbody>' + p.destTable.map(d => '<tr><td>' + esc(d.destination) + '</td>' + d.values.map(v => v == null ? '<td>—</td>' : '<td class="' + lfLevel(v).key + '">' + v.toFixed(1) + '%</td>').join('') + '</tr>').join('') + '</tbody></table></div><p class="muted">依 ' + ymText(p.lastYm) + '旅客人次排序。</p></section>';
  html += '<section class="card" aria-labelledby="h-easy"><h2 id="h-easy" style="margin-top:0;font-size:19px">想避開人潮？' + ymText(p.lastYm) + '相對好訂的選項</h2><ol class="easy">' + p.easiest.map(r => '<li><b>' + esc(routeLabel(r)) + '</b> ' + esc(r.airline) + '：' + r.loadFactor.toFixed(1) + '%<small>' + fmt(r.flights) + ' 班</small></li>').join('') + '</ol><p class="muted">當月至少 ' + MIN_FLIGHTS + ' 班；整月平均、往返合計，不代表特定日期或票價。</p></section>';
  html += '</div>';
  html += '<section class="faq" aria-labelledby="h-faq"><h2 id="h-faq">常見問題</h2>' + faq.map((f, i) => '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>';
  html += '<section aria-labelledby="h-more"><h2 id="h-more">延伸閱讀</h2><p class="links"><a href="/#route-rankings">本月最空與最滿航線</a><a href="/airport/tpe/#route-rankings">桃園機場航線排行</a><a href="/airport/khh/#route-rankings">高雄機場航線排行</a>' + (opts.latestReportPath ? '<a href="' + opts.latestReportPath + '">最新一期月報</a>' : '') + '<a href="/insights/">全部月報與洞察</a></p></section>';
  html += '</article></main><footer class="wrap foot"><p>資料來源：<a href="' + CAA_URL + '" rel="nofollow">交通部民用航空局</a> 國際及兩岸定期航線統計；載客率 = 旅客 ÷ 座位，整月平均、往返合計。頁面於 <time datetime="' + buildDate + '">' + buildDate + '</time> 自動建置。｜ <a href="/privacy/">隱私權政策</a></p></footer></body></html>\n';
  return { html, title, canonical };
}

/**
 * Generate every configured holiday preview. Returns [{ slug, path, title, holidayDate, active }].
 * active = build date is before the holiday (used for the homepage entry link).
 */
function generateHolidayPreviews(records, opts) {
  const root = opts.root, siteUrl = opts.siteUrl;
  const buildDate = opts.buildDate || new Date().toISOString().slice(0, 10);
  const out = [];
  for (const cfg of loadHolidayConfigs(root)) {
    const p = computeHolidayPreview(records, cfg, opts.destinationMap);
    if (!p.series.length) { console.warn('Holiday preview skipped (no data): ' + cfg.slug); continue; }
    const dir = path.join(root, 'insights', cfg.slug);
    const file = path.join(dir, 'index.html');
    let datePublished = buildDate;
    if (fs.existsSync(file)) {
      const m = fs.readFileSync(file, 'utf8').match(/"datePublished":"(\d{4}-\d{2}-\d{2})"/);
      if (m && m[1] < buildDate) datePublished = m[1];
    }
    const page = renderHolidayPage(p, { siteUrl, buildDate, datePublished, latestReportPath: opts.latestReportPath });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, page.html, 'utf8');
    console.log('Generated holiday preview: /insights/' + cfg.slug + '/');
    out.push({ slug: cfg.slug, path: '/insights/' + cfg.slug + '/', title: page.title, holidayDate: cfg.holidayDate, active: buildDate < cfg.holidayDate });
  }
  return out;
}

module.exports = { generateHolidayPreviews, computeHolidayPreview, loadHolidayConfigs };
