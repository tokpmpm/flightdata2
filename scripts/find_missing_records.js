/**
 * find_missing_records.js
 * 找出 XLS 有、但 JSON 少掉的具體航線/航司記錄
 * 目標月份：2025-12、2026-01（已知有差異）
 */

const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const YEAR_MAP = { '111': 2022, '112': 2023, '113': 2024, '114': 2025, '115': 2026 };

// ─── 從 XLS 讀取航點×航司明細（非小計/合計行）──────────────────────────────
function readXlsDetail(fname) {
    const wb   = XLSX.readFile(path.join(__dirname, '..', 'extracted', fname));
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const records = [];
    let currentDest = null;

    for (let i = 9; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.every(c => c === null || c === undefined || c === '')) break;

        const col0 = r[0];  // 序號（字串"1"~"N" 或 空或類別文字）
        const col1 = r[1];  // 航點（有值）或 undefined（航司列）
        const col2 = r[2];  // 航空公司（有值）或 undefined（航點列）
        const col3 = r[3];  // 合計架次
        const col4 = r[4];  // 合計座位
        const col5 = r[5];  // 合計載客

        // 略過「總計」「合計」「小計」「國際航線」「兩岸航線」等分類行
        const skipWords = ['總計','合計','小計','國際航線','兩岸航線','合　　計'];
        const isSkip = skipWords.some(w =>
            String(col0||'').includes(w) ||
            String(col1||'').includes(w) ||
            String(col2||'').includes(w)
        );
        if (isSkip) continue;

        // 航點列：col1 有值、col2 無值
        if (col1 && !col2) {
            currentDest = String(col1).trim();
            continue;
        }

        // 航司明細列：col0 是純數字字串（'1','2',...），col2 有航司名
        const seq = String(col0 || '').trim();
        if (/^\d+$/.test(seq) && col2 && currentDest) {
            records.push({
                destination: currentDest,
                airline: String(col2).trim(),
                flights:    Number(col3) || 0,
                seats:      Number(col4) || 0,
                passengers: Number(col5) || 0,
            });
        }
    }

    return records;
}

// ─── 從 JSON 讀取同月份所有記錄 ────────────────────────────────────────────────
function readJsonDetail(year, month) {
    const raw = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'data', 'flight_data_all.json'), 'utf8'
    ));
    return raw.filter(r => r.year === year && r.month === month);
}

// ─── 比對函式 ──────────────────────────────────────────────────────────────────
function compareMonth(fname, year, month) {
    const label = `${year}-${String(month).padStart(2,'0')}`;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  比對月份：${label}（${fname}）`);
    console.log('═'.repeat(70));

    const xlsRows = readXlsDetail(fname);
    const jsonRows = readJsonDetail(year, month);

    // XLS 加總（作為基準）
    const xlsTotal = xlsRows.reduce((a, r) => ({
        flights: a.flights + r.flights,
        seats:   a.seats   + r.seats,
        passengers: a.passengers + r.passengers
    }), { flights: 0, seats: 0, passengers: 0 });

    // JSON 加總
    const jsonTotal = jsonRows.reduce((a, r) => ({
        flights: a.flights + (r.flights || 0),
        seats:   a.seats   + (r.totalSeats || 0),
        passengers: a.passengers + (r.passengers || 0)
    }), { flights: 0, seats: 0, passengers: 0 });

    console.log(`\n【XLS 明細筆數】${xlsRows.length} 筆`);
    console.log(`【JSON 明細筆數】${jsonRows.length} 筆`);
    console.log(`\n【加總比較】`);
    console.log(`  架次：XLS=${xlsTotal.flights.toLocaleString()} / JSON=${jsonTotal.flights.toLocaleString()} / 差=${jsonTotal.flights - xlsTotal.flights}`);
    console.log(`  座位：XLS=${xlsTotal.seats.toLocaleString()} / JSON=${jsonTotal.seats.toLocaleString()} / 差=${jsonTotal.seats - xlsTotal.seats}`);
    console.log(`  載客：XLS=${xlsTotal.passengers.toLocaleString()} / JSON=${jsonTotal.passengers.toLocaleString()} / 差=${jsonTotal.passengers - xlsTotal.passengers}`);

    // 建立 JSON lookup map：key = "目的地|航空公司"（需要先了解 JSON 的欄位名）
    // JSON 欄位：destination, airline, flights, totalSeats, passengers
    const jsonMap = {};
    jsonRows.forEach(r => {
        const key = `${r.destination}|${r.airline}`;
        if (!jsonMap[key]) jsonMap[key] = { flights: 0, seats: 0, passengers: 0 };
        jsonMap[key].flights    += r.flights    || 0;
        jsonMap[key].seats      += r.totalSeats || 0;
        jsonMap[key].passengers += r.passengers || 0;
    });

    // 找出 XLS 有但 JSON 缺少或數值不同的
    console.log('\n【差異明細（XLS vs JSON，差異 ≠ 0 的航線×航司）】');
    console.log(`${'─'.repeat(80)}`);
    console.log('目的地          航空公司     XLS架次  JSON架次  差  │  XLS座位   JSON座位   差  │  XLS載客   JSON載客   差');
    console.log(`${'─'.repeat(80)}`);

    let diffCount = 0;
    xlsRows.forEach(xr => {
        const key = `${xr.destination}|${xr.airline}`;
        const jr  = jsonMap[key] || { flights: 0, seats: 0, passengers: 0 };

        const df = jr.flights    - xr.flights;
        const ds = jr.seats      - xr.seats;
        const dp = jr.passengers - xr.passengers;

        if (df !== 0 || ds !== 0 || dp !== 0) {
            diffCount++;
            const dest    = xr.destination.padEnd(14);
            const airline = xr.airline.padEnd(10);
            console.log(
                `${dest} ${airline} ` +
                `${String(xr.flights).padStart(7)} / ${String(jr.flights).padStart(7)} (${df >= 0 ? '+' : ''}${df})  │ ` +
                `${String(xr.seats).padStart(8)} / ${String(jr.seats).padStart(8)} (${ds >= 0 ? '+' : ''}${ds})  │ ` +
                `${String(xr.passengers).padStart(8)} / ${String(jr.passengers).padStart(8)} (${dp >= 0 ? '+' : ''}${dp})`
            );
        }
    });

    // 也找 JSON 有但 XLS 沒有的
    const xlsMap = {};
    xlsRows.forEach(r => { xlsMap[`${r.destination}|${r.airline}`] = r; });
    jsonRows.forEach(r => {
        const key = `${r.destination}|${r.airline}`;
        if (!xlsMap[key]) {
            diffCount++;
            console.log(`  ⬅️  JSON 多出（XLS 無此記錄）: ${r.destination} / ${r.airline}  flights=${r.flights} seats=${r.totalSeats} pax=${r.passengers}`);
        }
    });

    if (diffCount === 0) {
        console.log('  （無差異，所有航線×航司完全一致）');
    } else {
        console.log(`${'─'.repeat(80)}`);
        console.log(`  共 ${diffCount} 筆有差異`);
    }
}

// ─── 執行 ────────────────────────────────────────────────────────────────────
compareMonth('114年12月.xls', 2025, 12);
compareMonth('115年1月.xls',  2026, 1);
