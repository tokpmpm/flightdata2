const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dataPath = path.join(ROOT, 'data', 'flight_data_all.json');
if (!fs.existsSync(dataPath)) throw new Error('Missing data/flight_data_all.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const latest = data.reduce((b, r) => {
  const y = Number(r.year), m = Number(r.month), key = y * 100 + m;
  return key > b.key ? { key, year:y, month:m } : b;
}, { key:0, year:0, month:0 });

const year = latest.year;
const month = latest.month;
const month2 = String(month).padStart(2, '0');
const priorYear = year - 1;
const reportUrl = '/insights/' + year + '-' + month2 + '-taiwan-aviation-monthly-report/';
const reportPath = path.join(ROOT, reportUrl, 'index.html');

let checks = 0;
let failures = 0;
function check(ok, label) {
  checks += 1;
  if (ok) console.log('✅ ' + label);
  else { failures += 1; console.error('❌ ' + label); }
}
function sum(rows) {
  return rows.reduce((a,r) => {
    a.flights += Number(r.flights || 0);
    a.totalSeats += Number(r.totalSeats || r.seats || 0);
    a.passengers += Number(r.passengers || 0);
    return a;
  }, {flights:0,totalSeats:0,passengers:0});
}
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function lf(s) { return s.totalSeats ? s.passengers / s.totalSeats * 100 : 0; }

check(fs.existsSync(reportPath), '最新月份月報存在: ' + reportUrl);
if (!fs.existsSync(reportPath)) process.exit(1);

const html = fs.readFileSync(reportPath, 'utf8');
const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');

const currentRows = data.filter(r => Number(r.year) === year && Number(r.month) === month);
const priorRows = data.filter(r => Number(r.year) === priorYear && Number(r.month) === month);
const cur = sum(currentRows), prev = sum(priorRows);
const curLf = lf(cur), prevLf = lf(prev);

check(/^<!doctype html>/i.test(html), '月報使用 HTML5 doctype');
check(/<html[^>]+lang="zh-Hant"/.test(html), '月報 lang=zh-Hant');
check((html.match(/<h1\b/gi) || []).length === 1, '月報只有一個 H1');
check(html.includes(year + ' 年 ' + month + ' 月台灣航空月報'), 'title / H1 使用最新月份');
check(html.includes('flightdata2.meshthings.com' + reportUrl), 'canonical 指向最新月份 URL');
check(html.includes('<time datetime="' + year + '-' + month2 + '">'), '月報機器可讀月份正確');
check(html.includes('https://www.caa.gov.tw/article.aspx?a=1752&lang=1'), 'CAA 官方來源存在');
check(html.includes('/data/flight_data_all.csv') && html.includes('/data/flight_data_all.json'), 'CSV / JSON 下載連結存在');

for (const type of ['Article','WebPage','Dataset','FAQPage','BreadcrumbList']) {
  check(html.includes('"@type": "' + type + '"'), 'JSON-LD 包含 ' + type);
}
check(html.includes('"temporalCoverage": "' + priorYear + '-' + month2 + '/' + year + '-' + month2 + '"'), 'Dataset temporalCoverage 正確');

check(currentRows.length > 0, '最新月份有資料');
check(priorRows.length > 0, '去年同期有資料');
check(html.includes(fmt(cur.flights)), '月報航班數與資料一致');
check(html.includes(fmt(cur.totalSeats)), '月報座位數與資料一致');
check(html.includes(fmt(cur.passengers)), '月報旅客數與資料一致');
check(html.includes(curLf.toFixed(2) + '%'), '月報最新載客率與資料一致');
check(html.includes(prevLf.toFixed(2) + '%'), '月報去年同期載客率與資料一致');

for (const airline of ['長榮','中華','星宇','台灣虎航']) {
  const s = sum(currentRows.filter(r => r.airline === airline));
  check(s.passengers > 0 && html.includes(fmt(s.passengers)), airline + ' 旅客數存在且正確');
}
for (const airport of ['桃園國際機場','高雄國際機場','臺北松山機場','臺中清泉崗機場']) {
  const s = sum(currentRows.filter(r => r.airport === airport));
  check(s.passengers > 0, airport + ' 最新月份有資料');
}

check(home.includes(reportUrl), '首頁導覽指向最新月報');
check(!home.includes('/insights/2026-07-taiwan-aviation-monthly-report/') || (year === 2026 && month === 7), '首頁不再固定指向 2026/07 月報');
check(sitemap.includes('https://flightdata2.meshthings.com' + reportUrl), 'sitemap 收錄最新月報');
check(llms.includes(year + ' 年 ' + month + ' 月台灣航空月報'), 'llms.txt 使用最新月報月份');
check(llms.includes('https://flightdata2.meshthings.com' + reportUrl), 'llms.txt 指向最新月報');

console.log('\nMonthly report verification: ' + (checks - failures) + '/' + checks + ' checks passed.');
if (failures) process.exit(1);
