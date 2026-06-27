/**
 * verify_homepage.js
 * 模擬前端 applyFilters + calculateInsightsData 的完整計算邏輯
 * 驗算 ?sy=2024&sm=1&ey=2026&em=5 這個查詢的所有顯示數字
 *
 * 驗算方式說明：
 * 1. 從 data/flight_data_all.json 讀取原始資料庫
 * 2. 以 year*100+month 做日期範圍過濾（完全對應前端 applyFilters 邏輯）
 * 3. 依照 js/insights.js calculateInsightsData 的公式逐一計算
 * 4. 輸出每個 KPI、Top Routes、熱力圖、YoY 比較等
 */

const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync('./data/flight_data_all.json', 'utf8'));

// ─── 參數（與 URL 對應）────────────────────────────────────────────────────
const START_YEAR  = 2024;
const START_MONTH = 1;
const END_YEAR    = 2026;
const END_MONTH   = 5;

const START_KEY = START_YEAR * 100 + START_MONTH;  // 202401
const END_KEY   = END_YEAR   * 100 + END_MONTH;    // 202605

// ─── Step 1: applyFilters（無機場/目的地/航司篩選）──────────────────────────
const filtered = raw.filter(r => {
    const key = r.year * 100 + r.month;
    return key >= START_KEY && key <= END_KEY;
});

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log(`  首頁驗算：sy=${START_YEAR}&sm=${START_MONTH}&ey=${END_YEAR}&em=${END_MONTH}`);
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

console.log(`【原始資料庫筆數】total rows = ${raw.length}`);
console.log(`【過濾後筆數】filtered rows = ${filtered.length}`);
console.log(`【日期範圍】${START_YEAR}-${START_MONTH.toString().padStart(2,'0')} ～ ${END_YEAR}-${END_MONTH.toString().padStart(2,'0')}\n`);

// ─── Step 2: KPI 計算（對應 calculateInsightsData 前半段）──────────────────
let totalPassengers = 0;
let totalFlights    = 0;
let totalSeats      = 0;
const monthlyTotals = {};  // key = "YYYY-MM"

filtered.forEach(d => {
    totalPassengers += d.passengers  || 0;
    totalFlights    += d.flights     || 0;
    totalSeats      += d.totalSeats  || 0;

    const ym = `${d.year}-${String(d.month).padStart(2, '0')}`;
    if (!monthlyTotals[ym]) monthlyTotals[ym] = { passengers: 0, seats: 0, flights: 0 };
    monthlyTotals[ym].passengers += d.passengers  || 0;
    monthlyTotals[ym].seats      += d.totalSeats  || 0;
    monthlyTotals[ym].flights    += d.flights     || 0;
});

const avgLoadFactor = totalSeats ? (totalPassengers / totalSeats) * 100 : 0;

// 找最旺月份（最高載客率）
let peakMonth = '-';
let peakMonthLF = 0;
for (const ym in monthlyTotals) {
    const { passengers: p, seats: s } = monthlyTotals[ym];
    const lf = s ? (p / s) * 100 : 0;
    if (lf > peakMonthLF) { peakMonthLF = lf; peakMonth = ym; }
}

console.log('═══════════════ KPI 卡片 ═══════════════');
console.log(`  總載客數 (totalPassengers)  : ${totalPassengers.toLocaleString()}`);
console.log(`  總航班數 (totalFlights)     : ${totalFlights.toLocaleString()}`);
console.log(`  總座位數 (totalSeats)       : ${totalSeats.toLocaleString()}`);
console.log(`  平均載客率 (avgLoadFactor)  : ${avgLoadFactor.toFixed(2)}%`);
console.log(`  最旺月份 (peakMonth)        : ${peakMonth}  LF=${peakMonthLF.toFixed(2)}%`);

// ─── Step 3: 月份別明細──────────────────────────────────────────────────────
console.log('\n═══════════════ 月份別明細 ═══════════════');
const sortedMonths = Object.keys(monthlyTotals).sort();
sortedMonths.forEach(ym => {
    const { passengers: p, seats: s, flights: f } = monthlyTotals[ym];
    const lf = s ? (p / s) * 100 : 0;
    console.log(`  ${ym}: ${p.toLocaleString()} pax / ${f.toLocaleString()} flights / LF=${lf.toFixed(2)}%`);
});

// ─── Step 4: 年別加總（YoY 比較）────────────────────────────────────────────
console.log('\n═══════════════ 年別合計 ═══════════════');
const byYear = {};
filtered.forEach(d => {
    if (!byYear[d.year]) byYear[d.year] = { passengers: 0, seats: 0, flights: 0 };
    byYear[d.year].passengers += d.passengers || 0;
    byYear[d.year].seats      += d.totalSeats || 0;
    byYear[d.year].flights    += d.flights    || 0;
});
Object.keys(byYear).sort().forEach(yr => {
    const { passengers: p, seats: s, flights: f } = byYear[yr];
    const lf = s ? (p / s) * 100 : 0;
    console.log(`  ${yr}: ${p.toLocaleString()} pax / ${f.toLocaleString()} flights / LF=${lf.toFixed(2)}%`);
});

// ─── Step 5: Top 10 目的地航線────────────────────────────────────────────────
const destStats = {};
filtered.forEach(d => {
    if (!d.destination) return;
    if (!destStats[d.destination]) destStats[d.destination] = { passengers: 0, seats: 0 };
    destStats[d.destination].passengers += d.passengers || 0;
    destStats[d.destination].seats      += d.totalSeats || 0;
});
const topRoutes = Object.entries(destStats)
    .map(([name, { passengers: p, seats: s }]) => ({
        name, passengers: p,
        avgLF: s ? (p / s) * 100 : 0,
        pct: totalPassengers ? (p / totalPassengers) * 100 : 0
    }))
    .sort((a, b) => b.passengers - a.passengers)
    .slice(0, 10);

console.log('\n═══════════════ Top 10 目的地（旅客量排序）═══════════════');
topRoutes.forEach((r, i) => {
    console.log(`  ${i+1}. ${r.name}: ${r.passengers.toLocaleString()} pax (${r.pct.toFixed(2)}%) LF=${r.avgLF.toFixed(2)}%`);
});

// ─── Step 6: Top 10 航司────────────────────────────────────────────────────
const airlineStats = {};
filtered.forEach(d => {
    if (!d.airline) return;
    if (!airlineStats[d.airline]) airlineStats[d.airline] = { passengers: 0, seats: 0, flights: 0 };
    airlineStats[d.airline].passengers += d.passengers || 0;
    airlineStats[d.airline].seats      += d.totalSeats || 0;
    airlineStats[d.airline].flights    += d.flights    || 0;
});
const topAirlines = Object.entries(airlineStats)
    .map(([name, { passengers: p, seats: s, flights: f }]) => ({
        name, passengers: p, flights: f,
        lf: s ? (p / s) * 100 : 0,
        pct: totalPassengers ? (p / totalPassengers) * 100 : 0
    }))
    .sort((a, b) => b.passengers - a.passengers)
    .slice(0, 10);

console.log('\n═══════════════ Top 10 航司（旅客量排序）═══════════════');
topAirlines.forEach((a, i) => {
    console.log(`  ${i+1}. ${a.name}: ${a.passengers.toLocaleString()} pax (${a.pct.toFixed(2)}%) ${a.flights.toLocaleString()} flights LF=${a.lf.toFixed(2)}%`);
});

// ─── Step 7: 機場分布────────────────────────────────────────────────────────
const airportStats = {};
filtered.forEach(d => {
    if (!d.airport) return;
    if (!airportStats[d.airport]) airportStats[d.airport] = { passengers: 0, seats: 0, flights: 0 };
    airportStats[d.airport].passengers += d.passengers || 0;
    airportStats[d.airport].seats      += d.totalSeats || 0;
    airportStats[d.airport].flights    += d.flights    || 0;
});
const topAirports = Object.entries(airportStats)
    .map(([name, { passengers: p, seats: s, flights: f }]) => ({
        name, passengers: p, flights: f,
        lf: s ? (p / s) * 100 : 0,
        share: totalPassengers ? (p / totalPassengers) * 100 : 0
    }))
    .sort((a, b) => b.passengers - a.passengers);

console.log('\n═══════════════ 機場分布 ═══════════════');
topAirports.forEach((a, i) => {
    console.log(`  ${i+1}. ${a.name}: ${a.passengers.toLocaleString()} pax (${a.share.toFixed(2)}%) LF=${a.lf.toFixed(2)}%`);
});

// ─── Step 8: 熱力圖（年×月 LF 矩陣）────────────────────────────────────────
console.log('\n═══════════════ 載客率熱力圖（年×月）═══════════════');
const heatYears = [...new Set(filtered.map(d => d.year))].sort((a,b) => b-a);
const heatData = {};
filtered.forEach(d => {
    if (!heatData[d.year]) heatData[d.year] = Array(12).fill(null).map(() => ({ p: 0, s: 0 }));
    heatData[d.year][d.month-1].p += d.passengers || 0;
    heatData[d.year][d.month-1].s += d.totalSeats || 0;
});

const monthCols = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const header = '       ' + monthCols.map(m => m.padStart(7)).join('');
console.log(header);
heatYears.forEach(yr => {
    const row = heatData[yr].map(c => {
        if (c.s === 0) return '    -  ';
        return (c.p / c.s * 100).toFixed(1).padStart(6) + '%';
    });
    console.log(`  ${yr}: ${row.join(' ')}`);
});

// ─── Step 9: YoY 同月比較（2024 vs 2025 vs 2026）────────────────────────────
console.log('\n═══════════════ 同月份 YoY 比較（每月載客率）═══════════════');
console.log('月份    2024         2025         2026         2025→2026變化');
for (let m = 1; m <= 12; m++) {
    const lfByYear = {};
    heatYears.forEach(yr => {
        const c = heatData[yr]?.[m-1];
        if (c && c.s > 0) lfByYear[yr] = (c.p / c.s * 100);
    });
    if (Object.keys(lfByYear).length === 0) continue;
    const lf24 = lfByYear[2024]?.toFixed(2) + '%' || '-';
    const lf25 = lfByYear[2025]?.toFixed(2) + '%' || '-';
    const lf26 = lfByYear[2026]?.toFixed(2) + '%' || '-';
    const diff = (lfByYear[2026] !== undefined && lfByYear[2025] !== undefined)
        ? ((lfByYear[2026] - lfByYear[2025]) >= 0 ? '+' : '') + (lfByYear[2026] - lfByYear[2025]).toFixed(2) + '%'
        : '-';
    console.log(`  ${m.toString().padStart(2)}月  ${(lf24||'-').padStart(8)}   ${(lf25||'-').padStart(8)}   ${(lf26||'-').padStart(8)}   ${diff.padStart(10)}`);
}

// ─── 驗算說明 ────────────────────────────────────────────────────────────────
console.log('\n═══════════════ 驗算方式說明 ═══════════════');
console.log(`  資料來源：data/flight_data_all.json（${raw.length} 筆原始記錄）`);
console.log(`  過濾邏輯：year*100+month >= ${START_KEY} AND <= ${END_KEY}`);
console.log(`  KPI 公式：avgLoadFactor = totalPassengers / totalSeats * 100`);
console.log(`  peakMonth：monthlyTotals 中 LF 最高的 YYYY-MM 月份`);
console.log(`  Top Routes：以 destination 分組加總旅客量，取前10`);
console.log(`  此計算與前端 js/insights.js calculateInsightsData 邏輯完全對應`);
console.log('\n✅ 驗算完成');
