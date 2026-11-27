// Route-level insights shared by the dashboard pages (home / airport / airline),
// the monthly report and holiday previews.
// computeRouteInsights() is pure: records in, plain data out. Render functions only format.
const fs = require('fs');
const path = require('path');

const CAA_URL = 'https://www.caa.gov.tw/article.aspx?a=1752&lang=1';
const MIN_FLIGHTS = 30;

// Same codes as js/app.js AIRPORT_CODES (used for ?airport= and /airport/{code}/ URLs).
const AIRPORT_CODE = {
  '桃園國際機場': 'tpe', '高雄國際機場': 'khh', '臺北松山機場': 'tsa',
  '臺中清泉崗機場': 'rmq', '臺南機場': 'tnn', '花蓮機場': 'hun'
};
const SHOW_TOP = 5; // rows visible before the <details> "show all" toggle

const AIRPORT_SHORT = {
  '桃園國際機場': '桃園', '高雄國際機場': '高雄', '臺北松山機場': '松山',
  '臺中清泉崗機場': '台中', '臺南機場': '台南', '花蓮機場': '花蓮'
};

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function wan(n) { n = Number(n || 0); return n >= 10000 ? (n / 10000).toFixed(1) + ' 萬' : fmt(n); }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function round1(n) { return Math.round(n * 10) / 10; }
function signedPct(n) { return n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
function shortAirport(a) { return AIRPORT_SHORT[a] || a; }
function routeLabel(r) { return shortAirport(r.airport) + ' → ' + r.destination; }

// 載客率分級：≥90 幾乎客滿、80–90 偏滿、70–80 普通、<70 好訂
function lfLevel(lf) {
  if (lf >= 90) return { key: 'full', text: '幾乎客滿' };
  if (lf >= 80) return { key: 'busy', text: '偏滿' };
  if (lf >= 70) return { key: 'mid', text: '普通' };
  return { key: 'easy', text: '好訂' };
}

// DESTINATION_MAP lives in data/flight_data_new.js after the (huge) flightData literal.
// Parse only that object so we never evaluate the file.
function loadDestinationMap(root) {
  const file = path.join(root, 'data', 'flight_data_new.js');
  const content = fs.readFileSync(file, 'utf8');
  const start = content.indexOf('const DESTINATION_MAP');
  if (start === -1) throw new Error('DESTINATION_MAP not found in data/flight_data_new.js');
  const open = content.indexOf('{', start);
  const close = content.indexOf('\n};', open);
  if (open === -1 || close === -1) throw new Error('DESTINATION_MAP boundaries not found');
  return JSON.parse(content.slice(open, close + 2));
}

function countryOf(destinationMap, dest) {
  const d = destinationMap && destinationMap[dest];
  return (d && d.country) || '其他';
}

function aggregate(rows, keyFn) {
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

function latestYearMonth(records) {
  let key = 0;
  for (const r of records) { const k = Number(r.year) * 100 + Number(r.month); if (k > key) key = k; }
  return { year: Math.floor(key / 100), month: key % 100 };
}

/**
 * @param {Array} records flattened rows for one page scope
 * @param {Object} opts { scope: 'all'|'airport'|'airline', destinationMap, minFlights, growthMinPax, topN, year, month }
 */
function computeRouteInsights(records, opts) {
  opts = opts || {};
  const scope = opts.scope || 'all';
  const minFlights = opts.minFlights || MIN_FLIGHTS;
  const topN = opts.topN || 10;
  const growthMinPax = opts.growthMinPax != null ? opts.growthMinPax : (scope === 'all' ? 20000 : 5000);
  const ym = opts.year ? { year: Number(opts.year), month: Number(opts.month) } : latestYearMonth(records);
  const { year, month } = ym;
  const priorYear = year - 1;
  const cur = records.filter(r => Number(r.year) === year && Number(r.month) === month);
  const prev = records.filter(r => Number(r.year) === priorYear && Number(r.month) === month);

  // 1. Routes = airport × destination × airline, monthly, both directions combined.
  const routeAgg = aggregate(cur, r => r.airport + '|' + r.destination + '|' + r.airline);
  const routes = [];
  for (const [, a] of routeAgg) {
    if (!a.seats) continue;
    routes.push({
      airport: a.sample.airport, destination: a.sample.destination, airline: a.sample.airline,
      flights: a.flights, seats: a.seats, passengers: a.passengers,
      loadFactor: a.passengers / a.seats * 100, emptySeats: Math.max(0, a.seats - a.passengers)
    });
  }
  const eligible = routes.filter(r => r.flights >= minFlights);
  const emptiest = [...eligible].sort((a, b) => a.loadFactor - b.loadFactor || b.flights - a.flights).slice(0, topN);
  const fullest = [...eligible].sort((a, b) => b.loadFactor - a.loadFactor || b.flights - a.flights).slice(0, topN);

  // 2. Same route, different airlines: the widest load-factor gap.
  let duel = null;
  if (scope !== 'airline') {
    const byRoute = new Map();
    for (const r of eligible) {
      const k = r.airport + '|' + r.destination;
      if (!byRoute.has(k)) byRoute.set(k, []);
      byRoute.get(k).push(r);
    }
    for (const [, list] of byRoute) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => b.loadFactor - a.loadFactor);
      const gap = sorted[0].loadFactor - sorted[sorted.length - 1].loadFactor;
      const flights = sorted.reduce((s, r) => s + r.flights, 0);
      if (!duel || gap > duel.gap || (gap === duel.gap && flights > duel.flights)) {
        duel = { airport: sorted[0].airport, destination: sorted[0].destination, airlines: sorted, gap, flights };
      }
    }
  }

  // 3. Destinations and countries, with YoY against the same month last year.
  const destCur = aggregate(cur, r => r.destination);
  const destPrev = aggregate(prev, r => r.destination);
  const destinations = [];
  for (const [dest, a] of destCur) {
    const p = destPrev.get(dest);
    destinations.push({
      destination: dest, country: countryOf(opts.destinationMap, dest),
      passengers: a.passengers, seats: a.seats, flights: a.flights,
      loadFactor: a.seats ? a.passengers / a.seats * 100 : 0,
      prevPassengers: p ? p.passengers : 0,
      yoy: p && p.passengers ? (a.passengers / p.passengers - 1) * 100 : null
    });
  }
  const topDestinations = [...destinations].sort((a, b) => b.passengers - a.passengers).slice(0, 10);
  const fastestGrowing = destinations
    .filter(d => d.passengers >= growthMinPax && d.yoy != null && d.yoy > 0)
    .sort((a, b) => b.yoy - a.yoy).slice(0, 5);

  let countries = [];
  if (opts.destinationMap) {
    const cCur = aggregate(cur, r => countryOf(opts.destinationMap, r.destination));
    const cPrev = aggregate(prev, r => countryOf(opts.destinationMap, r.destination));
    for (const [country, a] of cCur) {
      const p = cPrev.get(country);
      countries.push({
        country, passengers: a.passengers,
        loadFactor: a.seats ? a.passengers / a.seats * 100 : 0,
        yoy: p && p.passengers ? (a.passengers / p.passengers - 1) * 100 : null
      });
    }
    countries = countries.filter(c => c.country !== '其他').sort((a, b) => b.passengers - a.passengers).slice(0, 8);
  }

  return {
    year, month, priorYear, scope, minFlights, growthMinPax,
    eligibleCount: eligible.length,
    emptiest, fullest, duel, topDestinations, fastestGrowing, countries
  };
}

// ---------- rendering ----------

// base64url (UTF-8, no padding) — same format as js/app.js base64Encode() for ?dest=
function b64url(str) { return Buffer.from(String(str), 'utf8').toString('base64url'); }

/**
 * Fallback URL (works without JS) that opens the dashboard filtered to one route.
 * opts.pagePath: '/', '/airport/tpe/' or '/airline/starlux/'. The period is left to the page default;
 * js/app.js intercepts the click and keeps the period the visitor already picked.
 */
function routeHref(airport, destination, opts) {
  const pagePath = (opts && opts.pagePath) || '/';
  const params = [];
  if (airport && !/^\/airport\//.test(pagePath)) params.push('airport=' + (AIRPORT_CODE[airport] || encodeURIComponent(airport)));
  if (destination) params.push('dest=' + b64url(destination));
  return pagePath + (params.length ? '?' + params.join('&') : '');
}

// Route name as a link that sets the dashboard filters (airport + destination; airline is not a filter).
function routeLink(airport, destination, label, opts) {
  const what = airport ? shortAirport(airport) + ' → ' + destination : destination;
  const scopeText = opts && opts.scope === 'airline' ? (opts.subject || '') + '在此航線' : '全部航空合計';
  const title = '點擊查看' + what + '完整數據（' + scopeText + '，期間維持目前選擇）';
  return '<a class="rr-link" href="' + esc(routeHref(airport, destination, opts)) + '" rel="nofollow"'
    + ' data-airport="' + esc(airport || '') + '" data-destination="' + esc(destination) + '"'
    + ' title="' + esc(title) + '">' + esc(label) + '</a>';
}

function rankRows(items, offset, opts) {
  return items.map((r, i) => {
    const lv = lfLevel(r.loadFactor);
    const lf = round1(r.loadFactor);
    return '<li class="rr-item" data-lf="' + lf.toFixed(1) + '" data-flights="' + r.flights + '">'
      + '<span class="rr-rank">' + (offset + i + 1) + '</span>'
      + '<span class="rr-name"><strong>' + routeLink(r.airport, r.destination, routeLabel(r), opts) + '</strong><small>' + esc(r.airline) + '・' + fmt(r.flights) + ' 班</small></span>'
      + '<span class="rr-value">' + lf.toFixed(1) + '%<span class="rr-chip rr-chip--' + lv.key + '">' + lv.text + '</span></span>'
      + '<span class="rr-bar" aria-hidden="true"><i class="rr-fill--' + lv.key + '" style="width:' + Math.min(100, lf).toFixed(1) + '%"></i></span>'
      + '</li>';
  }).join('');
}

// Top SHOW_TOP visible; the rest stays in the prerendered HTML inside a native <details>.
function collapsible(items, renderRows, listAttrs, moreLabel) {
  const head = items.slice(0, SHOW_TOP), rest = items.slice(SHOW_TOP);
  let html = '<ol class="rr-list"' + (listAttrs || '') + '>' + renderRows(head, 0) + '</ol>';
  if (rest.length) {
    html += '<details class="rr-more"><summary>' + esc(moreLabel || ('展開看全部 ' + items.length + ' 名')) + '</summary>'
      + '<ol class="rr-list" start="' + (SHOW_TOP + 1) + '">' + renderRows(rest, SHOW_TOP) + '</ol></details>';
  }
  return html;
}

function rankList(kind, items, opts) {
  return '<div class="rr-ranked" data-rank-list="' + kind + '">'
    + collapsible(items, (rows, offset) => rankRows(rows, offset, opts))
    + '</div><!-- /rr-ranked -->';
}

function renderRouteRankingsSection(data, opts) {
  opts = opts || {};
  const subject = opts.subject || '台灣';
  const ymText = data.year + ' 年 ' + data.month + ' 月';
  const showRoutes = data.emptiest.length >= 3;
  let html = '<section class="route-rankings" id="route-rankings" aria-labelledby="route-rankings-title">';
  const linkOpts = { pagePath: opts.pagePath || '/', scope: data.scope, subject };
  html += '<div class="rr-head"><h2 class="section-title" id="route-rankings-title"><span class="icon">🧭</span>' + esc(subject) + ' ' + ymText + '：最空與最滿航線</h2>'
    + '<span class="rr-snapshot">最新月份快照・不受上方篩選影響</span></div>';
  html += '<p class="rr-intro">依「機場 × 目的地 × 航空公司」計算 ' + ymText + '的載客率（旅客 ÷ 座位），當月至少 ' + data.minFlights + ' 班才列入，共 ' + fmt(data.eligibleCount) + ' 組。點航線名稱可在上方查看該航線的完整趨勢（' + (data.scope === 'airline' ? esc(subject) + '在該航線的數據' : '全部航空合計') + '，期間維持你目前的選擇）。</p>';
  html += '<p class="rr-legend"><span class="rr-chip rr-chip--easy">70% 以下 好訂</span><span class="rr-chip rr-chip--mid">70–80% 普通</span><span class="rr-chip rr-chip--busy">80–90% 偏滿</span><span class="rr-chip rr-chip--full">90% 以上 幾乎客滿</span></p>';

  if (showRoutes) {
    html += '<div class="rr-grid">'
      + '<div class="rr-card"><h3>最空航線 TOP' + data.emptiest.length + '</h3><p class="rr-note">空位最多、相對好訂</p>' + rankList('emptiest', data.emptiest, linkOpts) + '</div>'
      + '<div class="rr-card"><h3>最滿航線 TOP' + data.fullest.length + '</h3><p class="rr-note">一位難求</p>' + rankList('fullest', data.fullest, linkOpts) + '</div>'
      + '</div>';
  }

  if (data.duel && data.scope !== 'airline') {
    const d = data.duel;
    html += '<div class="rr-card rr-duel"><h3>同一條' + routeLink(d.airport, d.destination, shortAirport(d.airport) + ' → ' + d.destination, linkOpts) + '，最滿和最空差了 ' + round1(d.gap).toFixed(1) + ' 個百分點</h3>'
      + d.airlines.map(a => {
        const lv = lfLevel(a.loadFactor);
        return '<div class="rr-duel-row"><b>' + esc(a.airline) + '</b><span class="rr-bar rr-bar--tall" aria-hidden="true"><i class="rr-fill--' + lv.key + '" style="width:' + Math.min(100, a.loadFactor).toFixed(1) + '%"></i></span><span class="rr-value">' + round1(a.loadFactor).toFixed(1) + '%</span></div>';
      }).join('')
      + '<p class="rr-note">各家當月皆至少 ' + data.minFlights + ' 班。</p></div>';
  }

  if (data.topDestinations.length) {
    html += '<h3 class="rr-subtitle">' + esc(subject) + ' ' + ymText + '熱門航點</h3>';
    if (data.countries && data.countries.length) {
      html += '<div class="rr-countries">' + data.countries.map(c => '<div class="rr-country"><b>' + esc(c.country) + '</b><span class="rr-big">' + wan(c.passengers) + '</span><small>年增 ' + signedPct(c.yoy) + '・載客率 ' + c.loadFactor.toFixed(1) + '%</small></div>').join('') + '</div>';
    }
    html += '<div class="rr-grid">';
    // Destination rows link to the destination filter; the airport is the page's own (airport pages) or left as 全部機場.
    const destAirport = data.scope === 'airport' ? (opts.pageAirport || '') : '';
    const destTable = rows => '<div class="rr-table-wrap"><table class="rr-table"><thead><tr><th scope="col">目的地</th><th scope="col">旅客人次</th><th scope="col">年增</th><th scope="col">載客率</th></tr></thead><tbody>'
      + rows.map(t => '<tr><td>' + routeLink(destAirport, t.destination, t.destination, linkOpts) + '</td><td>' + fmt(t.passengers) + '</td><td>' + signedPct(t.yoy) + '</td><td>' + t.loadFactor.toFixed(1) + '%</td></tr>').join('')
      + '</tbody></table></div>';
    const topHead = data.topDestinations.slice(0, SHOW_TOP), topRest = data.topDestinations.slice(SHOW_TOP);
    html += '<div class="rr-card"><h4>旅客最多 TOP' + data.topDestinations.length + '</h4>' + destTable(topHead)
      + (topRest.length ? '<details class="rr-more"><summary>展開看全部 ' + data.topDestinations.length + ' 名</summary>' + destTable(topRest) + '</details>' : '')
      + '</div>';
    if (data.fastestGrowing.length) {
      html += '<div class="rr-card"><h4>年增最快 TOP' + data.fastestGrowing.length + '</h4><p class="rr-note">當月旅客 ' + fmt(data.growthMinPax) + ' 人次以上，對照 ' + data.priorYear + ' 年 ' + data.month + ' 月</p><ol class="rr-list">'
        + data.fastestGrowing.map((t, i) => '<li class="rr-item"><span class="rr-rank">' + (i + 1) + '</span><span class="rr-name"><strong>' + routeLink(destAirport, t.destination, t.destination, linkOpts) + '</strong><small>' + esc(t.country) + '・' + wan(t.passengers) + ' 人次</small></span><span class="rr-value rr-up">' + signedPct(t.yoy) + '</span></li>').join('')
        + '</ol></div>';
    }
    html += '</div>';
  }

  const links = (opts.extraLinks || []).map(l => '<a href="' + esc(l.href) + '">' + esc(l.text) + '</a>').join('');
  html += '<p class="rr-source">載客率為整月平均、往返合計，非即時空位，也不代表票價。資料來源：<a href="' + CAA_URL + '" rel="nofollow">交通部民用航空局</a> 國際及兩岸定期航線統計。' + (links ? ' ' + links : '') + '</p>';
  html += '</section>';
  return html;
}

function routeFaq(data, subject) {
  if (!data.emptiest.length) return [];
  const ymText = data.year + '年' + data.month + '月';
  const e = data.emptiest[0], f = data.fullest[0];
  return [
    {
      q: ymText + subject + '哪條航線最空？',
      a: '當月至少 ' + data.minFlights + ' 班的航線中，' + routeLabel(e) + '（' + e.airline + '）載客率最低，為 ' + round1(e.loadFactor).toFixed(1) + '%，' + fmt(e.flights) + ' 班共 ' + fmt(e.seats) + ' 個座位、' + fmt(e.passengers) + ' 位旅客。'
    },
    {
      q: ymText + subject + '哪條航線最滿？',
      a: routeLabel(f) + '（' + f.airline + '）載客率 ' + round1(f.loadFactor).toFixed(1) + '% 最高，' + fmt(f.flights) + ' 班 ' + fmt(f.seats) + ' 個座位，整月只剩約 ' + fmt(f.emptySeats) + ' 個空位。'
    }
  ];
}

function routeItemLists(data, subject, pageUrl) {
  if (data.emptiest.length < 3) return [];
  const ymText = data.year + ' 年 ' + data.month + ' 月';
  const list = (name, items) => ({
    '@context': 'https://schema.org', '@type': 'ItemList', name,
    url: pageUrl + '#route-rankings', numberOfItems: items.length, itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: items.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: routeLabel(r) + '（' + r.airline + '）載客率 ' + round1(r.loadFactor).toFixed(1) + '%' }))
  });
  return [
    list(subject + ' ' + ymText + '最空航線 TOP' + data.emptiest.length, data.emptiest),
    list(subject + ' ' + ymText + '最滿航線 TOP' + data.fullest.length, data.fullest)
  ];
}

module.exports = {
  MIN_FLIGHTS, AIRPORT_SHORT, AIRPORT_CODE, CAA_URL, routeHref,
  loadDestinationMap, countryOf, computeRouteInsights, lfLevel,
  renderRouteRankingsSection, routeFaq, routeItemLists, routeLabel, shortAirport
};
