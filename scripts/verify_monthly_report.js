/**
 * Verify the 2026-07 monthly report against local data and its SEO/AEO/GEO contract.
 * This is intentionally dependency-free so it can run as part of the static build.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT_URL = '/insights/2026-07-taiwan-aviation-monthly-report/';
const reportPath = path.join(ROOT, REPORT_URL, 'index.html');
const dataPath = path.join(ROOT, 'data', 'flight_data_all.json');

let checks = 0;
let failures = 0;
function check(condition, message) {
    checks += 1;
    if (!condition) {
        failures += 1;
        console.error('❌ ' + message);
    } else {
        console.log('✅ ' + message);
    }
}
function fail(message) {
    failures += 1;
    console.error('❌ ' + message);
}
function fmt(value) {
    return Number(value).toLocaleString('en-US');
}
function pct(value, digits = 1) {
    return value.toFixed(digits) + '%';
}
function aggregate(rows) {
    return rows.reduce((acc, row) => {
        acc.flights += Number(row.flights);
        acc.totalSeats += Number(row.totalSeats);
        acc.passengers += Number(row.passengers);
        return acc;
    }, { flights: 0, totalSeats: 0, passengers: 0 });
}
function lf(summary) {
    return summary.totalSeats ? summary.passengers / summary.totalSeats * 100 : 0;
}
function growth(current, prior) {
    return prior ? (current / prior - 1) * 100 : null;
}
function by(rows, field) {
    return rows.reduce((map, row) => {
        const key = row[field];
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
        return map;
    }, new Map());
}
function requireText(html, text, label) {
    check(html.includes(text), label + ': ' + text);
}

if (!fs.existsSync(reportPath)) fail('月報檔案不存在: ' + reportPath);
if (!fs.existsSync(dataPath)) fail('資料檔案不存在: ' + dataPath);
if (failures > 0) process.exit(1);

const html = fs.readFileSync(reportPath, 'utf8');
const homeTemplate = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

check(/^<!doctype html>/i.test(html), '月報使用 HTML5 doctype');
check(/<html[^>]+lang="zh-Hant"/.test(html), '月報 lang=zh-Hant');
check((html.match(/<h1\b/gi) || []).length === 1, '月報只有一個 H1');
check((html.match(/<title>/gi) || []).length === 1 && html.includes('2026 年 7 月台灣航空月報'), '月報 title 包含主題與月份');
check((html.match(/<meta name="description"/gi) || []).length === 1 && /content="[^"]{40,}"/.test(html.match(/<meta name="description"[^>]+>/i)?.[0] || ''), '月報有具體 meta description');
check((html.match(/<link rel="canonical"/gi) || []).length === 1 && html.includes('flightdata2.meshthings.com' + REPORT_URL), '月報 canonical 指向正式 URL');
for (const key of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
    requireText(html, 'property="' + key + '"', 'OG metadata ' + key);
}
for (const key of ['twitter:card', 'twitter:title', 'twitter:description']) {
    requireText(html, 'name="' + key + '"', 'Twitter metadata ' + key);
}
check(html.includes('name="robots" content="index,follow'), '月報允許索引與追蹤');
check(html.includes('<main') && html.includes('<article>') && html.includes('role="contentinfo"'), '月報有 main/article/footer 語意結構');
check(html.includes('<time datetime="2026-07">') && html.includes('<time datetime="2026-08-26">'), '月報使用機器可讀日期');
requireText(html, 'https://www.caa.gov.tw/article.aspx?a=1752&lang=1', 'CAA 官方來源識別');
requireText(html, '/data/flight_data_all.csv', 'CSV distribution');
requireText(html, '/data/flight_data_all.json', 'JSON distribution');
requireText(html, '<a href="/">首頁</a>', '首頁導覽連結');
check(!html.includes('class="sourceLinks"'), '月報移除頁尾連結列');
check(!html.includes('百分點'), '月報載客率差異統一使用 %');
requireText(html, '載客率較去年同期</span><b>+7.73%</b>', '航空公司載客率差異使用 %');
requireText(html, '四柱合計 99.3%', '新增旅客圖表標示四柱合計');
requireText(html, '未列機場的淨變化約占 0.7%', '新增旅客圖表標示未列部分');

const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map(match => JSON.parse(match[1]));
const types = new Set(jsonLdBlocks.map(block => block['@type']));
for (const type of ['Article', 'WebPage', 'Dataset', 'FAQPage', 'BreadcrumbList']) {
    check(types.has(type), 'JSON-LD 包含 ' + type);
}
const dataset = jsonLdBlocks.find(block => block['@type'] === 'Dataset');
check(dataset && dataset.license === 'https://data.gov.tw/license', 'Dataset license 指向 data.gov.tw 授權');
check(dataset && dataset.isBasedOn === 'https://data.gov.tw/dataset/47492', 'Dataset isBasedOn 指向官方資料集');
check(dataset && dataset.creator && dataset.creator.name === '交通部民用航空局', 'Dataset creator 為民航局');
check(dataset && dataset.provider && dataset.provider.name === 'MeshThings FlightData', 'Dataset provider 可辨識');
check(dataset && dataset.temporalCoverage === '2025-07/2026-07', 'Dataset temporalCoverage 包含比較基準與報告月份');
check(dataset && dataset.spatialCoverage && dataset.spatialCoverage.name.includes('台灣'), 'Dataset spatialCoverage 指向台灣');
check(dataset && dataset.distribution && dataset.distribution.length === 2, 'Dataset 有 CSV/JSON distribution');
const faq = jsonLdBlocks.find(block => block['@type'] === 'FAQPage');
check(faq && faq.mainEntity.length === 3, 'FAQPage 有三個可直接回答的問題');
check(faq && faq.mainEntity.every(item => item.acceptedAnswer && item.acceptedAnswer.text), 'FAQPage 每題都有 acceptedAnswer');
const breadcrumb = jsonLdBlocks.find(block => block['@type'] === 'BreadcrumbList');
check(breadcrumb && breadcrumb.itemListElement.length === 3, 'BreadcrumbList 有首頁、洞察、月報三層');
const article = jsonLdBlocks.find(block => block['@type'] === 'Article');
check(article && article.inLanguage === 'zh-Hant-TW' && article.datePublished === '2026-08-26', 'Article 有語言與發布日期');
check(article && article.citation && article.citation.includes('caa.gov.tw/article.aspx?a=1752'), 'Article citation 指向 CAA');

const july = data.filter(row => row.yearMonth === '2026-07');
const prior = data.filter(row => row.yearMonth === '2025-07');
const currentTotal = aggregate(july);
const priorTotal = aggregate(prior);
check(july.length === 381, '2026-07 有 381 筆 route×airline×airport 紀錄');
check(currentTotal.flights === 25345 && currentTotal.totalSeats === 6251667 && currentTotal.passengers === 5331656, '2026-07 全市場合計正確');
check(priorTotal.flights === 25002 && priorTotal.totalSeats === 6157404 && priorTotal.passengers === 4903584, '2025-07 同期合計正確');
check(Math.abs(lf(currentTotal) - 85.28374911843513) < 1e-9 && Math.abs(lf(priorTotal) - 79.63719775411846) < 1e-9, '兩期加權載客率可重現');
check(html.includes(fmt(currentTotal.passengers)) && html.includes(fmt(priorTotal.passengers)), '月報包含兩期精確旅客人次');
check(html.includes(pct(growth(currentTotal.passengers, priorTotal.passengers))) && html.includes(pct(growth(currentTotal.totalSeats, priorTotal.totalSeats))), '月報包含旅客／座位 YoY');
check(html.includes('+' + (lf(currentTotal) - lf(priorTotal)).toFixed(2) + '%'), '月報包含整體載客率 % 變化');

const airports = by(july, 'airport');
const priorAirports = by(prior, 'airport');
for (const [name, expectedPax, expectedLF, expectedGrowth] of [
    ['桃園國際機場', 4245858, 85.09456514942352, 5.39503609019496],
    ['高雄國際機場', 599097, 84.10503706199461, 24.30610453716442],
    ['臺北松山機場', 259666, 92.49209244008777, 4.165145637688883],
    ['臺中清泉崗機場', 221443, 84.22864358879755, 56.99832681073109]
]) {
    const current = aggregate(airports.get(name) || []);
    const old = aggregate(priorAirports.get(name) || []);
    check(current.passengers === expectedPax && Math.abs(lf(current) - expectedLF) < 1e-9 && Math.abs(growth(current.passengers, old.passengers) - expectedGrowth) < 1e-9, name + ' KPI 可重算');
}
const airlines = by(july, 'airline');
const priorAirlines = by(prior, 'airline');
for (const [name, expectedPax, expectedLF, expectedGrowth, expectedDelta] of [
    ['長榮', 1219428, 85.31829907456189, 8.426272450098304, 7.727057040410074],
    ['中華', 989908, 86.23290099630036, 2.788527734195312, 8.830629047172465],
    ['星宇', 566972, 87.87443409634427, 29.904777615866116, 5.239050523755353],
    ['台灣虎航', 288893, 92.23914431673053, 7.194725105100863, 6.388290596037365]
]) {
    const current = aggregate(airlines.get(name) || []);
    const old = aggregate(priorAirlines.get(name) || []);
    check(current.passengers === expectedPax && Math.abs(lf(current) - expectedLF) < 1e-9 && Math.abs(growth(current.passengers, old.passengers) - expectedGrowth) < 1e-9 && Math.abs(lf(current) - lf(old) - expectedDelta) < 1e-9, name + ' KPI 可重算');
}
const airportDeltas = [...airports.keys()].reduce((total, name) => total + aggregate(airports.get(name)).passengers - aggregate(priorAirports.get(name) || []).passengers, 0);
const khhDelta = aggregate(airports.get('高雄國際機場')).passengers - aggregate(priorAirports.get('高雄國際機場')).passengers;
const rmqDelta = aggregate(airports.get('臺中清泉崗機場')).passengers - aggregate(priorAirports.get('臺中清泉崗機場')).passengers;
check(airportDeltas === 430854 && Math.abs((khhDelta + rmqDelta) / (currentTotal.passengers - priorTotal.passengers) * 100 - 46.146209048945) < 0.001, '新增旅客圖表分母與高雄＋台中占比可重算');
check(homeTemplate.includes(REPORT_URL), 'template.html 有月報首頁入口');
check(home.includes(REPORT_URL), '生成後首頁有月報首頁入口');
check(sitemap.includes('https://flightdata2.meshthings.com' + REPORT_URL), 'sitemap.xml 收錄月報 URL');
check(llms.includes('2026 年 7 月台灣航空月報') && llms.includes(REPORT_URL), 'llms.txt 收錄月報 URL');

console.log('\nMonthly report verification: ' + (checks - failures) + '/' + checks + ' checks passed.');
if (failures) {
    console.error('Monthly report verification failed: ' + failures + ' check(s).');
    process.exit(1);
}
