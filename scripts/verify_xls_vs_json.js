/**
 * verify_xls_vs_json.js
 *
 * 驗算流程：
 * 1. 讀取原始 XLS（extracted/11X年Y月.xls）→ 取「總計」列的飛行架次、座位總數、載客人數
 * 2. 讀取 data/flight_data_all.json → 按年月加總同樣欄位
 * 3. 逐月比對，計算誤差，超過 ±1% 標記 ⚠️
 * 4. 輸出全域總計比較
 *
 * XLS 欄位位置（Row 9「總計」列，0-indexed）：
 *   col 3 = 合計飛行架次
 *   col 4 = 合計座位總數
 *   col 5 = 合計載客人數
 *   col 6 = 合計載客率(%)
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

// ─── 民國→西元 映射 ────────────────────────────────────────────────────────
const YEAR_MAP = { '111': 2022, '112': 2023, '113': 2024, '114': 2025, '115': 2026 };
const MONTH_ZH = ['一','二','三','四','五','六','七','八','九','十','十一','十二'];

// ─── 讀取所有需要的 XLS（113-115年，符合 2024-01~2026-05）──────────────────
function readXlsMonthly() {
    const results = {};  // key = "YYYY-MM"
    const xlsDir  = path.join(__dirname, '..', 'extracted');
    const files   = fs.readdirSync(xlsDir).filter(f => f.endsWith('.xls'));

    files.forEach(fname => {
        // 解析檔名：如 "113年1月.xls"
        const match = fname.match(/^(\d+)年(\d+)月\.xls$/);
        if (!match) return;

        const rocYear  = match[1];
        const month    = parseInt(match[2]);
        const year     = YEAR_MAP[rocYear];
        if (!year) return;

        // 只處理 2024-01 ~ 2026-05
        const key = year * 100 + month;
        if (key < 202401 || key > 202605) return;

        const ym = `${year}-${String(month).padStart(2,'0')}`;

        try {
            const wb   = XLSX.readFile(path.join(xlsDir, fname));
            const ws   = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // 找到「總計」列（通常在 Row 9，但用掃描確保穩健）
            let totalRow = null;
            for (let i = 5; i < Math.min(rows.length, 20); i++) {
                const r = rows[i];
                if (r && (r[1] === '總計' || r[1] === '合　　計' || String(r[1]).includes('總計'))) {
                    totalRow = r;
                    break;
                }
            }

            if (!totalRow) {
                console.warn(`  ⚠️  ${fname}：找不到「總計」列`);
                return;
            }

            // 合計欄（col 3-6）
            const flights    = Number(totalRow[3]) || 0;
            const seats      = Number(totalRow[4]) || 0;
            const passengers = Number(totalRow[5]) || 0;
            const xlsLF      = Number(totalRow[6]) || 0;  // XLS 直接給的載客率

            results[ym] = { year, month, flights, seats, passengers, xlsLF, fname };
        } catch (e) {
            console.warn(`  ⚠️  讀取失敗 ${fname}:`, e.message);
        }
    });

    return results;
}

// ─── 讀取 JSON，按月加總 ──────────────────────────────────────────────────────
function readJsonMonthly() {
    const raw = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'data', 'flight_data_all.json'), 'utf8'
    ));

    const results = {};
    raw.forEach(r => {
        const key = r.year * 100 + r.month;
        if (key < 202401 || key > 202605) return;

        const ym = `${r.year}-${String(r.month).padStart(2,'0')}`;
        if (!results[ym]) results[ym] = { flights: 0, seats: 0, passengers: 0 };
        results[ym].flights    += r.flights    || 0;
        results[ym].seats      += r.totalSeats || 0;
        results[ym].passengers += r.passengers || 0;
    });

    return results;
}

// ─── 主程式 ──────────────────────────────────────────────────────────────────
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('  原始 XLS vs flight_data_all.json  逐月比對驗算');
console.log('  範圍：2024-01 ～ 2026-05');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

const xlsData  = readXlsMonthly();
const jsonData = readJsonMonthly();

const months = Array.from(
    new Set([...Object.keys(xlsData), ...Object.keys(jsonData)])
).sort();

// ─── 逐月比對 ─────────────────────────────────────────────────────────────────
console.log('─────────────────────────────────────────────────────────────────────────────────────────────────────');
console.log('月份      │ XLS架次   JSON架次  差異  │ XLS座位      JSON座位     差異   │ XLS載客      JSON載客     差異   │ XLS_LF  JSON_LF  差異');
console.log('─────────────────────────────────────────────────────────────────────────────────────────────────────');

let anyIssue = false;
const issues = [];

// 累計用
let totalXlsFlights = 0, totalJsonFlights = 0;
let totalXlsSeats   = 0, totalJsonSeats   = 0;
let totalXlsPax     = 0, totalJsonPax     = 0;

months.forEach(ym => {
    const x = xlsData[ym];
    const j = jsonData[ym];

    if (!x) { console.log(`${ym}  │ XLS 缺檔`); return; }
    if (!j) { console.log(`${ym}  │ JSON 缺月份`); return; }

    const dFlights = j.flights    - x.flights;
    const dSeats   = j.seats      - x.seats;
    const dPax     = j.passengers - x.passengers;

    const jsonLF   = x.seats ? (j.passengers / j.seats * 100) : 0;
    const dLF      = jsonLF - x.xlsLF;

    // 誤差率
    const pctFlights = x.flights ? (dFlights / x.flights * 100) : 0;
    const pctSeats   = x.seats   ? (dSeats   / x.seats   * 100) : 0;
    const pctPax     = x.passengers ? (dPax / x.passengers * 100) : 0;

    const hasIssue = Math.abs(pctFlights) > 1 || Math.abs(pctSeats) > 1 || Math.abs(pctPax) > 1 || Math.abs(dLF) > 1;
    const flag = hasIssue ? ' ⚠️ ' : '    ';
    if (hasIssue) {
        anyIssue = true;
        issues.push({ ym, pctFlights, pctSeats, pctPax, dLF, dFlights, dSeats, dPax });
    }

    totalXlsFlights += x.flights;    totalJsonFlights += j.flights;
    totalXlsSeats   += x.seats;      totalJsonSeats   += j.seats;
    totalXlsPax     += x.passengers; totalJsonPax     += j.passengers;

    const sign = v => v >= 0 ? `+${v.toFixed(0)}` : `${v.toFixed(0)}`;
    const pctFmt = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

    console.log(
        `${flag}${ym}  │` +
        ` ${String(x.flights).padStart(7)} / ${String(j.flights).padStart(7)} (${pctFmt(pctFlights).padStart(7)})  │` +
        ` ${String(x.seats).padStart(10)} / ${String(j.seats).padStart(10)} (${pctFmt(pctSeats).padStart(7)})  │` +
        ` ${String(x.passengers).padStart(10)} / ${String(j.passengers).padStart(10)} (${pctFmt(pctPax).padStart(7)})  │` +
        ` ${x.xlsLF.toFixed(1)}% / ${jsonLF.toFixed(1)}% (${(dLF >= 0 ? '+' : '') + dLF.toFixed(2)}%)`
    );
});

// ─── 全域總計 ─────────────────────────────────────────────────────────────────
console.log('─────────────────────────────────────────────────────────────────────────────────────────────────────');
const totalXlsLF  = totalXlsSeats  ? (totalXlsPax  / totalXlsSeats  * 100) : 0;
const totalJsonLF = totalJsonSeats ? (totalJsonPax / totalJsonSeats * 100) : 0;

console.log('\n═══════════════ 全期總計（2024-01 ～ 2026-05）═══════════════');
console.log(`  飛行架次： XLS=${totalXlsFlights.toLocaleString()}  JSON=${totalJsonFlights.toLocaleString()}  差異=${(totalJsonFlights-totalXlsFlights).toLocaleString()}`);
console.log(`  座位總數： XLS=${totalXlsSeats.toLocaleString()}  JSON=${totalJsonSeats.toLocaleString()}  差異=${(totalJsonSeats-totalXlsSeats).toLocaleString()}`);
console.log(`  載客人數： XLS=${totalXlsPax.toLocaleString()}  JSON=${totalJsonPax.toLocaleString()}  差異=${(totalJsonPax-totalXlsPax).toLocaleString()}`);
console.log(`  整體載客率：XLS=${totalXlsLF.toFixed(2)}%  JSON=${totalJsonLF.toFixed(2)}%  差異=${(totalJsonLF-totalXlsLF>=0?'+':'')+(totalJsonLF-totalXlsLF).toFixed(2)}%`);

// ─── 問題彙總 ─────────────────────────────────────────────────────────────────
console.log('\n═══════════════ 異常彙總（誤差 > ±1%）═══════════════');
if (!anyIssue) {
    console.log('  ✅ 全部月份誤差皆在 ±1% 以內，數據一致');
} else {
    issues.forEach(({ ym, pctFlights, pctSeats, pctPax, dLF, dFlights, dSeats, dPax }) => {
        console.log(`  ⚠️  ${ym}:`);
        if (Math.abs(pctFlights) > 1) console.log(`      架次誤差 ${pctFlights.toFixed(2)}%（差 ${dFlights}）`);
        if (Math.abs(pctSeats)   > 1) console.log(`      座位誤差 ${pctSeats.toFixed(2)}%（差 ${dSeats}）`);
        if (Math.abs(pctPax)     > 1) console.log(`      載客誤差 ${pctPax.toFixed(2)}%（差 ${dPax}）`);
        if (Math.abs(dLF)        > 1) console.log(`      載客率差 ${dLF.toFixed(2)}%`);
    });
}

// ─── 說明 ─────────────────────────────────────────────────────────────────────
console.log('\n═══════════════ 驗算說明 ═══════════════');
console.log('  XLS 來源：extracted/11X年Y月.xls，取 Sheet[0] 的「總計」列（合計欄）');
console.log('  XLS_LF：XLS 內建的載客率欄位（交通部計算值）');
console.log('  JSON 來源：data/flight_data_all.json，按年月加總 flights/totalSeats/passengers');
console.log('  JSON_LF：由 JSON 重新計算 passengers/totalSeats*100');
console.log('  判斷標準：任一欄位誤差 > ±1% 即標記 ⚠️');
