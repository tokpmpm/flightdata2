const fs = require('fs');
const path = require('path');

const CAA_URL = 'https://www.caa.gov.tw/article.aspx?a=1752&lang=1';
const DATASET_URL = 'https://data.gov.tw/dataset/47492';

function sum(rows) {
  return rows.reduce((a, r) => {
    a.flights += Number(r.flights || 0);
    a.totalSeats += Number(r.totalSeats || r.seats || 0);
    a.passengers += Number(r.passengers || 0);
    return a;
  }, { flights: 0, totalSeats: 0, passengers: 0 });
}
function lf(s) { return s.totalSeats ? s.passengers / s.totalSeats * 100 : 0; }
function growth(a, b) { return b ? (a / b - 1) * 100 : null; }
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function compact(n) { n = Number(n || 0); return Math.abs(n) >= 10000 ? (n / 10000).toFixed(1) + ' 萬' : fmt(n); }
function signed(n, d) { d = d === undefined ? 1 : d; return n === null || !Number.isFinite(n) ? 'N/A' : (n >= 0 ? '+' : '') + n.toFixed(d) + '%'; }
function pct(n, d) { d = d === undefined ? 2 : d; return Number(n || 0).toFixed(d) + '%'; }
function esc(v) { return String(v == null ? '' : v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function monthText(y, m) { return y + ' 年 ' + m + ' 月'; }

function oneMonth(rows, y, m, pred) {
  const picked = rows.filter(r => Number(r.year) === y && Number(r.month) === m && (!pred || pred(r)));
  const s = sum(picked);
  return Object.assign({}, s, { loadFactor: lf(s), rowCount: picked.length });
}

function generateMonthlyReport(rows, opts) {
  opts = opts || {};
  const root = opts.root || path.join(__dirname, '..');
  const siteUrl = opts.siteUrl || 'https://flightdata2.meshthings.com';
  if (!Array.isArray(rows) || !rows.length) throw new Error('Monthly report: empty data');

  const latest = rows.reduce((b, r) => {
    const y = Number(r.year), m = Number(r.month), key = y * 100 + m;
    return key > b.key ? { key, year: y, month: m } : b;
  }, { key: 0, year: 0, month: 0 });
  const year = latest.year, month = latest.month, priorYear = year - 1;
  const month2 = String(month).padStart(2, '0');
  const curRows = rows.filter(r => Number(r.year) === year && Number(r.month) === month);
  const prevRows = rows.filter(r => Number(r.year) === priorYear && Number(r.month) === month);
  if (!curRows.length || !prevRows.length) throw new Error('Monthly report: missing current/prior rows');

  const cur = sum(curRows), prev = sum(prevRows);
  const curLf = lf(cur), prevLf = lf(prev);
  const paxGrowth = growth(cur.passengers, prev.passengers);
  const seatGrowth = growth(cur.totalSeats, prev.totalSeats);
  const flightGrowth = growth(cur.flights, prev.flights);
  const lfChange = curLf - prevLf;
  const net = cur.passengers - prev.passengers;

  const airportDefs = [
    ['桃園國際機場','桃園','TPE'],['高雄國際機場','高雄','KHH'],
    ['臺北松山機場','松山','TSA'],['臺中清泉崗機場','台中','RMQ']
  ];
  const airlineDefs = [
    ['長榮','長榮航空','EVA Air · BR'],['中華','中華航空','China Airlines · CI'],
    ['星宇','星宇航空','STARLUX · JX'],['台灣虎航','台灣虎航','Tigerair Taiwan · IT']
  ];
  const airports = airportDefs.map(d => {
    const c = oneMonth(rows, year, month, r => r.airport === d[0]);
    const p = oneMonth(rows, priorYear, month, r => r.airport === d[0]);
    return { key:d[0], label:d[1], code:d[2], cur:c, prev:p, paxGrowth:growth(c.passengers,p.passengers), seatGrowth:growth(c.totalSeats,p.totalSeats), net:c.passengers-p.passengers };
  });
  const airlines = airlineDefs.map(d => {
    const c = oneMonth(rows, year, month, r => r.airline === d[0]);
    const p = oneMonth(rows, priorYear, month, r => r.airline === d[0]);
    return { key:d[0], label:d[1], code:d[2], cur:c, prev:p, paxGrowth:growth(c.passengers,p.passengers), seatGrowth:growth(c.totalSeats,p.totalSeats), lfChange:c.loadFactor-p.loadFactor };
  });

  const byPax = [...airlines].sort((a,b)=>b.cur.passengers-a.cur.passengers)[0];
  const byGrowth = [...airlines].sort((a,b)=>(b.paxGrowth ?? -1e9)-(a.paxGrowth ?? -1e9))[0];
  const byLf = [...airlines].sort((a,b)=>b.cur.loadFactor-a.cur.loadFactor)[0];
  const byLfGain = [...airlines].sort((a,b)=>b.lfChange-a.lfChange)[0];
  const fastestAirport = [...airports].sort((a,b)=>(b.paxGrowth ?? -1e9)-(a.paxGrowth ?? -1e9))[0];
  const khh = airports.find(a=>a.key==='高雄國際機場');
  const rmq = airports.find(a=>a.key==='臺中清泉崗機場');
  const regionalShare = net ? ((khh.net + rmq.net) / net * 100) : 0;
  const contributions = airports.map(a => Object.assign({}, a, { share: net ? a.net / net * 100 : 0 }));
  const shownShare = contributions.reduce((s,a)=>s+a.share,0);
  const nextMonth = month === 12 ? 1 : month + 1;
  const buildDate = new Date().toISOString().slice(0,10);
  const slug = year + '-' + month2 + '-taiwan-aviation-monthly-report';
  const reportPath = '/insights/' + slug + '/';
  const canonical = siteUrl + reportPath;
  const outDir = path.join(root, 'insights', slug);
  const outFile = path.join(outDir, 'index.html');

  function airlineTag(a) {
    if (a.key === byLf.key) return '載客率最高';
    if (a.key === byGrowth.key) return '旅客成長最快';
    if (a.key === byLfGain.key) return '載客率改善最多';
    if (a.key === byPax.key) return '旅客最多';
    return '主要航空';
  }
  const airportCards = airports.map(a => '<div class="card airport"><b>' + esc(a.label) + ' ' + esc(a.code) + '</b><div class="growth">' + signed(a.paxGrowth,1) + '</div><small>旅客年成長率<br>平均載客率 ' + pct(a.cur.loadFactor,1) + '</small></div>').join('');
  const airlineCards = airlines.map(a => '<article class="card airCard"><div class="airTop"><div><div class="airName">' + esc(a.label) + '</div><div class="airCode">' + esc(a.code) + '</div></div><span class="pill">' + esc(airlineTag(a)) + '</span></div><div class="airMetrics"><div class="metricBox"><span>' + month + ' 月旅客人次</span><b>' + fmt(a.cur.passengers) + '</b><small>' + signed(a.paxGrowth,1) + ' YoY</small></div><div class="metricBox"><span>旅客年成長率</span><b>' + signed(a.paxGrowth,1) + '</b><small>較 ' + priorYear + ' 年同期</small></div><div class="metricBox"><span>' + month + ' 月平均載客率</span><b>' + pct(a.cur.loadFactor,2) + '</b><small>去年 ' + pct(a.prev.loadFactor,2) + '</small></div><div class="metricBox"><span>載客率較去年同期</span><b>' + signed(a.lfChange,2) + '</b><small>' + pct(a.prev.loadFactor,2) + ' → ' + pct(a.cur.loadFactor,2) + '</small></div></div><div class="airNote">' + esc(a.label) + '本月旅客 ' + fmt(a.cur.passengers) + ' 人次，座位 ' + fmt(a.cur.totalSeats) + ' 個；旅客成長 ' + signed(a.paxGrowth,1) + '，座位成長 ' + signed(a.seatGrowth,1) + '。</div></article>').join('');
  const bars = contributions.map(a => {
    const width = Math.max(0, Math.min(100, a.share));
    return '<div class="bar" role="img" aria-label="' + esc(a.label) + '占全市場淨增旅客 ' + a.share.toFixed(1) + '%"><b>' + esc(a.label) + '</b><div class="track"><div class="fill" style="width:' + width.toFixed(1) + '%"></div></div><b>' + a.share.toFixed(1) + '%</b></div>';
  }).join('');

  const faq = [
    {q:monthText(year,month)+'台灣航空整體載客率是多少？',a:monthText(year,month)+'共 '+fmt(cur.flights)+' 班、'+fmt(cur.totalSeats)+' 個座位、'+fmt(cur.passengers)+' 人次；加權平均載客率為 '+pct(curLf,2)+'，較 '+priorYear+' 年同期的 '+pct(prevLf,2)+' 變化 '+signed(lfChange,2)+'。'},
    {q:monthText(year,month)+'哪一家主要航空公司的載客率最高？',a:'本月四家主要航空公司中，'+byLf.label+'最高（'+pct(byLf.cur.loadFactor,2)+'）。'},
    {q:monthText(year,month)+'哪座主要機場旅客成長最快？',a:'四座主要機場中，'+fastestAirport.label+'旅客年成長率最高，為 '+signed(fastestAirport.paxGrowth,1)+'。'}
  ];

  const schemas = [
    {'@context':'https://schema.org','@type':'Article',headline:monthText(year,month)+'台灣航空月報',datePublished:buildDate,dateModified:buildDate,inLanguage:'zh-Hant-TW',mainEntityOfPage:canonical,citation:CAA_URL,author:{'@type':'Organization',name:'MeshThings FlightData'}},
    {'@context':'https://schema.org','@type':'WebPage',name:monthText(year,month)+'台灣航空月報',url:canonical,inLanguage:'zh-Hant-TW'},
    {'@context':'https://schema.org','@type':'Dataset',name:monthText(year,month)+'台灣航空載客率資料',description:monthText(year,month)+'台灣主要機場與航空公司航班、座位、旅客與載客率統計。',temporalCoverage:priorYear+'-'+month2+'/'+year+'-'+month2,spatialCoverage:{'@type':'Place',name:'台灣'},license:'https://data.gov.tw/license',isBasedOn:DATASET_URL,creator:{'@type':'GovernmentOrganization',name:'交通部民用航空局'},provider:{'@type':'Organization',name:'MeshThings FlightData'},distribution:[{'@type':'DataDownload',encodingFormat:'text/csv',contentUrl:siteUrl+'/data/flight_data_all.csv'},{'@type':'DataDownload',encodingFormat:'application/json',contentUrl:siteUrl+'/data/flight_data_all.json'}]},
    {'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.q,acceptedAnswer:{'@type':'Answer',text:x.a}}))},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'首頁',item:siteUrl+'/'},{'@type':'ListItem',position:2,name:'洞察',item:siteUrl+'/insights/'},{'@type':'ListItem',position:3,name:monthText(year,month)+'台灣航空月報',item:canonical}]}
  ];

  const css = ':root{--bg:#f6ecd8;--paper:#fffaf1;--soft:#fcf4e7;--line:#dec7a2;--text:#4a3427;--muted:#7c6654;--accent:#c67c4d;--focus:#6b3f25}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#3b2b20;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif}a{color:#8e4f2c}.wrap{max-width:1080px;margin:auto;padding:0 20px}.nav{background:#fbf5ea;border-bottom:1px solid var(--line)}.navin{max-width:1080px;margin:auto;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:10px;font-weight:900;color:var(--text);text-decoration:none}.logo{width:40px;height:40px;border-radius:13px;background:var(--accent);color:#fff;display:grid;place-items:center}.navlinks{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:14px;font-weight:800}.navlinks a{text-decoration:none}.month{font-size:12px;font-weight:800;padding:7px 11px;border-radius:999px;background:#ead2aa}.hero{padding:54px 0 24px}.heroGrid{display:grid;grid-template-columns:1.1fr .9fr;gap:28px;align-items:center}.hero h1{font-size:clamp(38px,5.8vw,62px);line-height:1.08;letter-spacing:-.055em;margin:10px 0 14px}.eyebrow,.tag{font-size:12px;font-weight:900;color:#b26a3c}.heroStory{font-size:21px;line-height:1.65;font-weight:850}.lead{font-size:18px;line-height:1.84}.heroCard{background:linear-gradient(135deg,#f0d3ad,#e4b984);border:1px solid #dbb687;border-radius:30px;padding:28px}.big{font-size:54px;font-weight:950;margin:7px 0}.section{margin-top:36px}.card{background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:0 8px 20px rgba(124,87,57,.06)}.summary,.story,.airCard,.method,.compareBox,.noteBox,.watch .card{padding:22px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.stat{padding:18px}.stat strong{display:block;font-size:29px;margin-top:6px}.stat span,.muted{font-size:12px;color:var(--muted)}.storyGrid,.airGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.airTop{display:flex;justify-content:space-between}.airName{font-size:21px;font-weight:900}.airCode{font-size:12px;color:#8a735f}.pill{font-size:11px;font-weight:850;padding:6px 9px;border-radius:999px;background:#f1dcc0}.airMetrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.metricBox{padding:13px;border-radius:15px;background:var(--soft);border:1px solid #e2ccb0}.metricBox span,.metricBox small{display:block;font-size:11px;color:#826d5a}.metricBox b{display:block;font-size:20px}.airNote{margin-top:15px;font-size:14px;line-height:1.8}.airportGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.airport{padding:18px}.growth{font-size:31px;font-weight:950;margin:8px 0;color:#b3673b}.compareGrid{display:grid;grid-template-columns:1.15fr .85fr;gap:14px}.bar{display:grid;grid-template-columns:105px 1fr 68px;gap:12px;align-items:center;margin-top:14px}.track{height:11px;border-radius:999px;background:#ead8bd;overflow:hidden}.fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#c67c4d,#e0a66d)}.watch{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.dataTableWrap{overflow-x:auto}.dataTable{width:100%;border-collapse:collapse;min-width:620px;font-size:14px}.dataTable th,.dataTable td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:right}.dataTable th:first-child,.dataTable td:first-child{text-align:left}.faq details{padding:14px 0;border-bottom:1px solid var(--line)}.foot{margin-top:44px;padding:20px 0;border-top:1px solid #d5bc95;font-size:12px;color:#77604e}.srOnly{position:absolute;width:1px;height:1px;overflow:hidden}.quote{margin-top:16px;padding:15px;border-radius:15px;background:#f4e4ca;border-left:4px solid var(--accent)}@media(max-width:850px){.heroGrid,.storyGrid,.compareGrid{grid-template-columns:1fr}.stats,.airportGrid{grid-template-columns:1fr 1fr}.watch{grid-template-columns:1fr}}@media(max-width:650px){.wrap{padding:0 13px}.airGrid{grid-template-columns:1fr}.bar{grid-template-columns:80px 1fr 58px}}';

  let html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
  html += '<title>'+year+' 年 '+month+' 月台灣航空月報｜航班、旅客、載客率與機場趨勢</title>';
  html += '<meta name="description" content="'+year+' 年 '+month+' 月台灣航空月報：整理航班、座位、旅客、載客率、主要機場與長榮、華航、星宇、台灣虎航最新同比變化。"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="'+canonical+'">';
  html += '<meta property="og:title" content="'+year+' 年 '+month+' 月台灣航空月報"><meta property="og:description" content="旅客 '+signed(paxGrowth,1)+'、座位 '+signed(seatGrowth,1)+'、整體載客率 '+pct(curLf,2)+'。"><meta property="og:type" content="article"><meta property="og:url" content="'+canonical+'"><meta property="og:image" content="'+siteUrl+'/og-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="'+year+' 年 '+month+' 月台灣航空月報"><meta name="twitter:description" content="最新 CAA 航空市場月度數據整理。">';
  html += schemas.map(s=>'<script type="application/ld+json">'+JSON.stringify(s,null,2)+'</script>').join('') + '<style>'+css+'</style></head><body>';
  html += '<header class="nav"><nav class="navin"><a class="brand" href="/"><span class="logo">✈</span><span>台灣航空數據月報</span></a><div class="navlinks"><a href="/">首頁</a><a href="/about/">方法論</a><a href="/insights/2026-taiwan-aviation-market-outlook/">市場洞察</a><a href="'+reportPath+'" aria-current="page">'+month+' 月月報</a></div><span class="month"><time datetime="'+year+'-'+month2+'">'+monthText(year,month)+'</time></span></nav></header>';
  html += '<main class="wrap"><article><section class="hero"><div class="heroGrid"><div><div class="eyebrow">Taiwan Aviation · '+year+'-'+month2+'</div><h1>'+monthText(year,month)+'台灣航空月報</h1><p class="heroStory">'+month+' 月旅客 '+signed(paxGrowth,1)+'，座位 '+signed(seatGrowth,1)+'，整體載客率來到 '+pct(curLf,2)+'。</p><p class="lead">本月共 <strong>'+fmt(cur.passengers)+' 人次</strong>，較去年同期'+(net>=0?'增加':'減少')+' '+fmt(Math.abs(net))+' 人；航班 '+signed(flightGrowth,1)+'、座位 '+signed(seatGrowth,1)+'。</p></div><div class="heroCard"><small>'+monthText(year,month)+'整體加權載客率</small><div class="big">'+pct(curLf,2)+'</div><p>'+priorYear+' 年同期為 '+pct(prevLf,2)+'，變化 '+signed(lfChange,2)+'。</p></div></div></section>';
  html += '<section class="section"><div class="card summary"><h2>重點摘要</h2><ul><li><strong>全市場：</strong>'+monthText(year,month)+'載客 '+fmt(cur.passengers)+' 人次，較去年同期 '+signed(paxGrowth,1)+'。</li><li><strong>區域機場：</strong>高雄與台中合計貢獻全市場淨增旅客約 '+regionalShare.toFixed(1)+'%；'+fastestAirport.label+'旅客成長最快（'+signed(fastestAirport.paxGrowth,1)+'）。</li><li><strong>主要航空：</strong>'+byLf.label+'載客率最高（'+pct(byLf.cur.loadFactor,2)+'），'+byGrowth.label+'旅客成長最快（'+signed(byGrowth.paxGrowth,1)+'）。</li></ul></div></section>';
  html += '<section class="section"><h2 class="srOnly">整體指標</h2><div class="stats"><div class="card stat"><small>旅客人次</small><strong>'+compact(cur.passengers)+'</strong><span>'+signed(paxGrowth,1)+' YoY</span></div><div class="card stat"><small>座位供給</small><strong>'+compact(cur.totalSeats)+'</strong><span>'+signed(seatGrowth,1)+' YoY</span></div><div class="card stat"><small>航班數</small><strong>'+fmt(cur.flights)+'</strong><span>'+signed(flightGrowth,1)+' YoY</span></div><div class="card stat"><small>同比旅客變化</small><strong>'+compact(Math.abs(net))+'</strong><span>'+(net>=0?'增加':'減少')+'</span></div></div></section>';
  html += '<section class="section"><h2>本月值得注意的兩件事</h2><div class="storyGrid"><article class="card story"><div class="tag">01 · 整體市場</div><h3>旅客 '+signed(paxGrowth,1)+'，座位 '+signed(seatGrowth,1)+'</h3><p>旅客與座位供給增速差為 '+(paxGrowth-seatGrowth).toFixed(1)+' 個百分比。</p><div class="quote">整體載客率 '+pct(curLf,2)+'，較去年同期變化 '+signed(lfChange,2)+'。</div></article><article class="card story"><div class="tag">02 · 區域機場</div><h3>高雄＋台中約占淨增旅客 '+regionalShare.toFixed(1)+'%</h3><p>'+fastestAirport.label+'是四座主要機場中旅客成長最快的一座。</p></article></div></section>';
  html += '<section class="section"><h2>四家主要航空公司</h2><div class="airGrid">'+airlineCards+'</div></section>';
  html += '<section class="section"><h2>四座主要機場放在一起看</h2><div class="airportGrid">'+airportCards+'</div><p class="muted">四柱合計 '+shownShare.toFixed(1)+'%，未列機場淨變化約占 '+(100-shownShare).toFixed(1)+'%。</p></section>';
  html += '<section class="section"><div class="compareGrid"><div class="card compareBox"><h2>新增旅客從哪裡來？</h2>'+bars+'</div><div class="card noteBox"><div class="tag">下個月繼續觀察</div><h3>高雄＋台中合計約 '+regionalShare.toFixed(1)+'%</h3><p>接下來可繼續追旅客增幅是否仍跑贏座位供給。</p></div></div></section>';
  html += '<section class="section"><h2>精確數字與計算基準</h2><div class="card method dataTableWrap"><table class="dataTable"><caption>'+priorYear+' 年 '+month+' 月與 '+year+' 年 '+month+' 月比較</caption><thead><tr><th>指標</th><th>'+priorYear+' 年 '+month+' 月</th><th>'+year+' 年 '+month+' 月</th><th>YoY／變化</th></tr></thead><tbody><tr><th>航班數</th><td>'+fmt(prev.flights)+'</td><td>'+fmt(cur.flights)+'</td><td>'+signed(flightGrowth,1)+'</td></tr><tr><th>總座位數</th><td>'+fmt(prev.totalSeats)+'</td><td>'+fmt(cur.totalSeats)+'</td><td>'+signed(seatGrowth,1)+'</td></tr><tr><th>載客人數</th><td>'+fmt(prev.passengers)+'</td><td>'+fmt(cur.passengers)+'</td><td>'+signed(paxGrowth,1)+'</td></tr><tr><th>加權載客率</th><td>'+pct(prevLf,2)+'</td><td>'+pct(curLf,2)+'</td><td>'+signed(lfChange,2)+'</td></tr></tbody></table><p>資料期間：<time datetime="'+year+'-'+month2+'">'+monthText(year,month)+'</time>；來源：<a href="'+CAA_URL+'">交通部民用航空局</a>。CSV：<a href="/data/flight_data_all.csv">下載</a>｜JSON：<a href="/data/flight_data_all.json">下載</a></p></div></section>';
  html += '<section class="section"><h2>'+nextMonth+' 月我會想繼續看什麼？</h2><div class="watch"><div class="card"><b>'+fastestAirport.label+'的成長能不能延續？</b><small>本月旅客 '+signed(fastestAirport.paxGrowth,1)+'</small></div><div class="card"><b>區域機場還會不會繼續貢獻新增旅客？</b><small>高雄＋台中約占 '+regionalShare.toFixed(1)+'%</small></div><div class="card"><b>'+byGrowth.label+'的成長速度會不會續強？</b><small>本月旅客年增 '+signed(byGrowth.paxGrowth,1)+'</small></div></div></section>';
  html += '<section class="section faq"><h2>常見問題</h2>'+faq.map((x,i)=>'<details'+(i===0?' open':'')+'><summary>'+esc(x.q)+'</summary><p>'+esc(x.a)+'</p></details>').join('')+'</section></article></main>';
  html += '<footer class="wrap foot"><p><strong>資料說明：</strong>本頁整理 '+monthText(year,month)+'台灣國際及兩岸定期航線公開資料，頁面於 <time datetime="'+buildDate+'">'+buildDate+'</time> 自動建置。</p><p>來源：<a href="'+CAA_URL+'" rel="nofollow">交通部民用航空局</a> ｜ <a href="/privacy/">隱私權政策</a></p></footer></body></html>';

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  console.log('Generated monthly report: ' + reportPath);
  return { year, month, month2, path: reportPath, slug, outputFile: outFile, canonical, buildDate };
}

module.exports = { generateMonthlyReport };
