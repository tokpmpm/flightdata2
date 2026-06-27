/**
 * verify_data.js — 全面驗算報告數據
 * 對照原始 JSON 資料庫，交叉驗證所有顯示在報告中的數字
 */
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/flight_data_all.json', 'utf8'));

const YEAR = 2026;
const CMP_YEAR = 2025;
const MAX_MONTH = 5;

const filter = (yr, maxMo) => data.filter(d => d.year === yr && d.month <= maxMo);
const data2026 = filter(YEAR, MAX_MONTH);
const data2025 = filter(CMP_YEAR, MAX_MONTH);

const sum = (records) => {
    let passengers = 0, flights = 0, seats = 0;
    records.forEach(r => {
        passengers += r.passengers || 0;
        flights    += r.flights    || 0;
        seats      += r.totalSeats || 0;
    });
    return { passengers, flights, seats, lf: seats ? (passengers / seats) * 100 : 0 };
};

const byKey = (records, key) => {
    const map = {};
    records.forEach(r => {
        const k = r[key];
        if (!k) return;
        if (!map[k]) map[k] = { passengers: 0, seats: 0, flights: 0 };
        map[k].passengers += r.passengers || 0;
        map[k].seats      += r.totalSeats || 0;
        map[k].flights    += r.flights    || 0;
    });
    return map;
};

const stats26 = sum(data2026);
const stats25 = sum(data2025);

const dest26 = byKey(data2026, 'destination');
const dest25 = byKey(data2025, 'destination');
const airline26 = byKey(data2026, 'airline');
const airport26 = byKey(data2026, 'airport');

function lf(obj) { return obj.seats ? (obj.passengers / obj.seats) * 100 : 0; }

// ─── 月份別 ────────────────────────────────────────────────────────────────
const monthly26 = {};
const monthly25 = {};
for (let m = 1; m <= MAX_MONTH; m++) {
    monthly26[m] = sum(data2026.filter(r => r.month === m));
    monthly25[m] = sum(data2025.filter(r => r.month === m));
}

// ─── 旅客增量最多的目的地 ───────────────────────────────────────────────────
const destIncrease = Object.keys(dest26).map(d => ({
    name: d,
    p26: dest26[d].passengers,
    p25: dest25[d]?.passengers || 0,
    lf26: lf(dest26[d]),
    lf25: dest25[d] ? lf(dest25[d]) : 0,
    diff: dest26[d].passengers - (dest25[d]?.passengers || 0),
    lfDiff: lf(dest26[d]) - (dest25[d] ? lf(dest25[d]) : 0),
})).sort((a, b) => b.diff - a.diff);

// ─── 目的地旅客量排序 ──────────────────────────────────────────────────────
const destVol = Object.keys(dest26).map(d => ({
    name: d,
    passengers: dest26[d].passengers,
    lf: lf(dest26[d]),
    share: (dest26[d].passengers / stats26.passengers) * 100,
})).sort((a, b) => b.passengers - a.passengers);

// ─── 航司排序 ──────────────────────────────────────────────────────────────
const airlineSorted = Object.keys(airline26).map(name => ({
    name,
    ...airline26[name],
    lf: lf(airline26[name]),
})).sort((a, b) => b.passengers - a.passengers);

// ─── 機場排序 ──────────────────────────────────────────────────────────────
const airportSorted = Object.keys(airport26).map(name => ({
    name,
    passengers: airport26[name].passengers,
    lf: lf(airport26[name]),
    share: (airport26[name].passengers / stats26.passengers) * 100,
})).sort((a, b) => b.passengers - a.passengers);

// ═══════════════════════════════════════════════════════════════════════════
//  OUTPUT
// ═══════════════════════════════════════════════════════════════════════════
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('  2026 年 1-5 月台灣航空數據驗算報告（對照原始 JSON 資料庫）');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

// ── Q1 全局摘要 ─────────────────────────────────────────────────────────────
console.log('【Q1 全局摘要】');
console.log(`  2026 旅客量：${stats26.passengers.toLocaleString()} (${(stats26.passengers/10000).toFixed(1)} 萬)`);
console.log(`  2025 旅客量：${stats25.passengers.toLocaleString()} (${(stats25.passengers/10000).toFixed(1)} 萬)`);
console.log(`  旅客增長率：${((stats26.passengers/stats25.passengers-1)*100).toFixed(2)}%`);
console.log(`  2026 航班數：${stats26.flights.toLocaleString()}`);
console.log(`  2025 航班數：${stats25.flights.toLocaleString()}`);
console.log(`  航班增長率：${((stats26.flights/stats25.flights-1)*100).toFixed(2)}%`);
console.log(`  2026 座位數：${stats26.seats.toLocaleString()}`);
console.log(`  2025 座位數：${stats25.seats.toLocaleString()}`);
console.log(`  座位增長率：${((stats26.seats/stats25.seats-1)*100).toFixed(2)}%`);
console.log(`  2026 平均載客率：${stats26.lf.toFixed(2)}%`);
console.log(`  2025 平均載客率：${stats25.lf.toFixed(2)}%`);
console.log(`  載客率差距：${(stats26.lf - stats25.lf).toFixed(2)}%`);

// ── Q2 月份別 ───────────────────────────────────────────────────────────────
console.log('\n【Q2 月份別載客率 (2026 vs 2025)】');
const monthNames = ['', '1月', '2月', '3月', '4月', '5月'];
for (let m = 1; m <= MAX_MONTH; m++) {
    const m26 = monthly26[m];
    const m25 = monthly25[m];
    const lf26 = m26.lf;
    const lf25 = m25.lf;
    console.log(`  ${monthNames[m]}: 2026=${lf26.toFixed(2)}% (${(m26.passengers/10000).toFixed(1)}萬pax) | 2025=${lf25.toFixed(2)}% | 差距=${(lf26-lf25).toFixed(2)}%`);
}
const peakMonth = Object.keys(monthly26).sort((a,b) => monthly26[b].lf - monthly26[a].lf)[0];
const peakLF = monthly26[peakMonth].lf;
const peakPax = monthly26[peakMonth].passengers;
console.log(`  ★ 最旺月份：${peakMonth}月 LF=${peakLF.toFixed(2)}% 旅客量=${(peakPax/10000).toFixed(1)}萬`);

// ── Q3 旅客增量前5名 ─────────────────────────────────────────────────────────
console.log('\n【Q3 旅客增量前5名目的地】');
destIncrease.slice(0, 5).forEach((d, i) => {
    console.log(`  ${i+1}. ${d.name}: +${(d.diff/10000).toFixed(1)}萬 (${d.diff.toLocaleString()}人)  LF: ${d.lf25.toFixed(2)}%→${d.lf26.toFixed(2)}% (${d.lfDiff >= 0 ? '+' : ''}${d.lfDiff.toFixed(2)}%)`);
});

// ── Q4 香港 ──────────────────────────────────────────────────────────────────
console.log('\n【Q4 香港佔比】');
const hk = dest26['香港'] || {passengers:0,seats:0};
console.log(`  香港旅客量：${(hk.passengers/10000).toFixed(1)}萬 (${hk.passengers.toLocaleString()})`);
console.log(`  佔全台比例：${(hk.passengers/stats26.passengers*100).toFixed(2)}%`);
console.log(`  香港載客率：${lf(hk).toFixed(2)}%`);
console.log(`  全台平均載客率：${stats26.lf.toFixed(2)}%`);

// ── Q5 前10大目的地 ──────────────────────────────────────────────────────────
console.log('\n【Q5 前10大目的地 (旅客量)】');
destVol.slice(0, 10).forEach((d, i) => {
    console.log(`  ${i+1}. ${d.name}: ${(d.passengers/10000).toFixed(1)}萬 (${d.passengers.toLocaleString()}) LF=${d.lf.toFixed(2)}% Share=${d.share.toFixed(2)}%`);
});
const top4 = destVol.slice(0, 4).reduce((s, d) => s + d.passengers, 0);
console.log(`  前4大合計：${(top4/10000).toFixed(1)}萬 (${top4.toLocaleString()}) 佔比=${(top4/stats26.passengers*100).toFixed(2)}%`);

// ── Q6 四大台灣航司 ───────────────────────────────────────────────────────────
console.log('\n【Q6 四大台灣航司】');
const targetMap = {'長榮航空':'長榮', '中華航空':'中華', '星宇航空':'星宇', '台灣虎航':'台灣虎航'};
Object.entries(targetMap).forEach(([display, searchKey]) => {
    const key = Object.keys(airline26).find(k => k.includes(searchKey) || searchKey.includes(k));
    if (!key) { console.log(`  ${display}: 找不到資料 (searched "${searchKey}")`); return; }
    const a = airline26[key];
    const paxShare = (a.passengers / stats26.passengers * 100).toFixed(2);
    console.log(`  ${display} (${key}): 旅客=${a.passengers.toLocaleString()} (${(a.passengers/10000).toFixed(1)}萬) 航班=${a.flights.toLocaleString()} 座位=${a.seats.toLocaleString()} LF=${lf(a).toFixed(2)}% 市佔=${paxShare}%`);
});

// ── Q7 全航司 LF 前10 (航班>=125) ─────────────────────────────────────────────
console.log('\n【Q7 主要航司 LF 排行 (航班>=125)】');
airlineSorted.filter(a => a.flights >= 125).slice(0, 10).forEach((a, i) => {
    console.log(`  ${i+1}. ${a.name}: Flights=${a.flights} LF=${a.lf.toFixed(2)}%`);
});
// Also show top by LF regardless
console.log('\n  (所有航司，含航班<125，按 LF 降序)');
const allByLF = airlineSorted.slice().sort((a,b)=>b.lf-a.lf).slice(0,5);
allByLF.forEach((a, i) => console.log(`  ${i+1}. ${a.name}: Flights=${a.flights} LF=${a.lf.toFixed(2)}%`));

// ── Q8 四象限分析 ─────────────────────────────────────────────────────────────
console.log('\n【Q8 前10大目的地高低運量×載客率矩陣】');
const avgLF = stats26.lf;
const medVol = destVol[4]?.passengers || 0; // 取第5名當分水嶺
destVol.slice(0, 10).forEach(d => {
    const hi_vol = d.passengers > medVol ? '高運量' : '中低運量';
    const hi_lf  = d.lf >= avgLF ? '高載客率' : '低載客率';
    console.log(`  ${d.name}: ${hi_vol}+${hi_lf} (${(d.passengers/10000).toFixed(1)}萬 LF=${d.lf.toFixed(2)}%)`);
});

// ── Q9 機場分布 ────────────────────────────────────────────────────────────────
console.log('\n【Q9 各機場旅客分布】');
airportSorted.forEach((a, i) => {
    const lfStr = airport26[a.name].seats ? lf(airport26[a.name]).toFixed(2)+'%' : 'N/A';
    console.log(`  ${i+1}. ${a.name}: ${(a.passengers/10000).toFixed(1)}萬 (${a.passengers.toLocaleString()}) Share=${a.share.toFixed(2)}% LF=${lfStr}`);
});

// ── Q11 YoY 差值 Summary ──────────────────────────────────────────────────────
console.log('\n【Q11 同比摘要核對】');
console.log(`  旅客量增加：+${((stats26.passengers - stats25.passengers)/10000).toFixed(1)}萬 (+${((stats26.passengers/stats25.passengers-1)*100).toFixed(2)}%)`);
console.log(`  航班增加：+${(stats26.flights - stats25.flights).toLocaleString()} (+${((stats26.flights/stats25.flights-1)*100).toFixed(2)}%)`);
console.log(`  載客率提升：+${(stats26.lf - stats25.lf).toFixed(2)}pp`);

console.log('\n✅ 驗算完成');
