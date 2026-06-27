/**
 * update_report.js
 * 更新範圍：首頁 (index.html)、主要機場頁 (airports/)、主要航空頁 (airlines/)
 * ⚠️  insights/2026-taiwan-aviation-market-outlook/index.html 已凍結，不在此腳本更新範圍內
 */
const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, '..', 'data', 'flight_data_all.json');

console.log('Reading database from:', dataFilePath);
const rawData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

// ─── 篩選資料 ──────────────────────────────────────────────────────────────
const data2026 = rawData.filter(d => d.year === 2026);
const data2025 = rawData.filter(d => d.year === 2025);

if (data2026.length === 0) {
    console.error('No 2026 data found!');
    process.exit(1);
}

const latestMonth = Math.max(...data2026.map(d => d.month));
console.log(`Latest month in 2026 dataset: ${latestMonth}`);

// ─── 整體統計 ──────────────────────────────────────────────────────────────
const sumStats = (records) => {
    let passengers = 0, flights = 0, seats = 0;
    records.forEach(r => {
        passengers += r.passengers || 0;
        flights    += r.flights    || 0;
        seats      += r.totalSeats || 0;
    });
    return { passengers, flights, seats, lf: seats ? (passengers / seats) * 100 : 0 };
};

const stats2026 = sumStats(data2026);
const stats2025 = sumStats(data2025.filter(d => d.month <= latestMonth));

const paxGrowthPct    = ((stats2026.passengers - stats2025.passengers) / stats2025.passengers * 100).toFixed(1);
const flightsGrowthPct= ((stats2026.flights    - stats2025.flights)    / stats2025.flights    * 100).toFixed(1);
const seatsGrowthPct  = ((stats2026.seats      - stats2025.seats)      / stats2025.seats      * 100).toFixed(1);
const lfDiff          = (stats2026.lf - stats2025.lf).toFixed(1);
const todayString     = new Date().toISOString().split('T')[0];
const period          = `1-${latestMonth}`;

// ─── 機場統計 ──────────────────────────────────────────────────────────────
const airportMap = {};
data2026.forEach(r => {
    if (!airportMap[r.airport]) airportMap[r.airport] = { passengers: 0, seats: 0, flights: 0 };
    airportMap[r.airport].passengers += r.passengers || 0;
    airportMap[r.airport].seats      += r.totalSeats || 0;
    airportMap[r.airport].flights    += r.flights    || 0;
});
const sortedAirports = Object.keys(airportMap).map(name => {
    const { passengers, seats, flights } = airportMap[name];
    return { name, passengers, seats, flights,
             share: (passengers / stats2026.passengers) * 100,
             lf: seats ? (passengers / seats) * 100 : 0 };
}).sort((a, b) => b.passengers - a.passengers);

// ─── 航司統計 ──────────────────────────────────────────────────────────────
const airlineMap = {};
data2026.forEach(r => {
    if (!airlineMap[r.airline]) airlineMap[r.airline] = { passengers: 0, seats: 0, flights: 0 };
    airlineMap[r.airline].passengers += r.passengers || 0;
    airlineMap[r.airline].seats      += r.totalSeats || 0;
    airlineMap[r.airline].flights    += r.flights    || 0;
});
const sortedAirlines = Object.keys(airlineMap).map(name => {
    const { passengers, seats, flights } = airlineMap[name];
    return { name, passengers, seats, flights, lf: seats ? (passengers / seats) * 100 : 0 };
}).sort((a, b) => b.passengers - a.passengers);

// ─── 月份別統計（首頁趨勢圖用）────────────────────────────────────────────
const monthlyLabels = [];
const monthlyLF2026 = [];
const monthlyLF2025 = [];
for (let m = 1; m <= latestMonth; m++) {
    monthlyLabels.push(`${m}月`);
    const s26 = sumStats(data2026.filter(d => d.month === m));
    const s25 = sumStats(data2025.filter(d => d.month === m));
    monthlyLF2026.push(parseFloat(s26.lf.toFixed(1)));
    monthlyLF2025.push(parseFloat(s25.lf.toFixed(1)));
}

// ─── 工具函式 ──────────────────────────────────────────────────────────────
function updateFile(filePath, updater) {
    if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️  檔案不存在，跳過：${filePath}`);
        return;
    }
    let html = fs.readFileSync(filePath, 'utf8');
    html = updater(html);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  ✅ 已更新：${path.relative(path.join(__dirname, '..'), filePath)}`);
}

function replaceOrWarn(html, pattern, replacement, label) {
    const result = html.replace(pattern, replacement);
    if (result === html) console.warn(`    ⚠️  找不到匹配（${label}），跳過`);
    return result;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. 首頁 (index.html)
// ═══════════════════════════════════════════════════════════════════════
const indexPath = path.join(__dirname, '..', 'index.html');
console.log('\n[1/3] 更新首頁...');
updateFile(indexPath, html => {
    // 日期
    html = html.replace(/更新時間[：:][^\s<&]*/g, `更新時間：${todayString}`);
    html = html.replace(/dateModified['"]\s*:\s*['"][^'"]+['"]/g, `"dateModified": "${todayString}"`);
    html = html.replace(/<time datetime="[^"]*">[^<]*<\/time>/g,
        `<time datetime="${todayString}">更新：${todayString}</time>`);

    // 統計期間文字
    html = html.replace(/1-\d+ 月/g, `${period} 月`);
    html = html.replace(/1-\d+月/g, `${period}月`);

    // KPI 數字（旅客量、載客率）
    html = html.replace(/(\d{2,3},\d{3},\d{3})/g, (m) => {
        // 只替換全域旅客量
        if (m === '21616419' || m === '21,616,419') return stats2026.passengers.toLocaleString();
        return m;
    });

    // 月份趨勢圖
    html = html.replace(/(labels:\s*)\[(?:"[^"]*"(?:,\s*"[^"]*")*)\],/g,
        `$1${JSON.stringify(monthlyLabels)},`);
    html = html.replace(/(label:\s*'2026 年載客率[^']*',\s*data:\s*)\[[^\]]*\],/g,
        `$1${JSON.stringify(monthlyLF2026)},`);
    html = html.replace(/(label:\s*'2025 年載客率[^']*',\s*data:\s*)\[[^\]]*\],/g,
        `$1${JSON.stringify(monthlyLF2025)},`);

    return html;
});

// ═══════════════════════════════════════════════════════════════════════
// 2. 主要機場頁 (airports/ 目錄下所有 index.html)
// ═══════════════════════════════════════════════════════════════════════
const airportsDir = path.join(__dirname, '..', 'airports');
console.log('\n[2/3] 更新主要機場頁...');

if (fs.existsSync(airportsDir)) {
    const airportFolders = fs.readdirSync(airportsDir).filter(f =>
        fs.statSync(path.join(airportsDir, f)).isDirectory()
    );

    airportFolders.forEach(folder => {
        const filePath = path.join(airportsDir, folder, 'index.html');
        updateFile(filePath, html => {
            // 日期更新
            html = html.replace(/更新時間[：:][^\s<&]*/g, `更新時間：${todayString}`);
            html = html.replace(/dateModified['"]\s*:\s*['"][^'"]+['"]/g, `"dateModified": "${todayString}"`);
            html = html.replace(/<time datetime="[^"]*">更新：[^<]*<\/time>/g,
                `<time datetime="${todayString}">更新：${todayString}</time>`);

            // 統計期間
            html = html.replace(/1-\d+ 月/g, `${period} 月`);
            html = html.replace(/1-\d+月/g, `${period}月`);

            // 找到對應機場
            const matchedAirport = sortedAirports.find(a =>
                html.includes(a.name) || folder.includes(a.name.replace('國際機場','').replace('機場',''))
            );

            if (matchedAirport) {
                const ap = matchedAirport;
                // 旅客量
                html = html.replace(/(旅客量[^：：]*[：：]\s*)[\d,]+/g,
                    `$1${ap.passengers.toLocaleString()}`);
                // 載客率
                html = html.replace(/(平均載客率[^：：]*[：：]\s*)[\d.]+%/g,
                    `$1${ap.lf.toFixed(1)}%`);
                // 佔比
                html = html.replace(/(市場份額|客運佔比)[^：：]*[：：]\s*)[\d.]+%/g,
                    `$1${ap.share.toFixed(1)}%`);
            }

            // 月份趨勢圖
            html = html.replace(/(labels:\s*)\[(?:"[^"]*"(?:,\s*"[^"]*")*)\],/g,
                `$1${JSON.stringify(monthlyLabels)},`);
            html = html.replace(/(label:\s*'2026[^']*',\s*data:\s*)\[[^\]]*\],/g,
                `$1${JSON.stringify(monthlyLF2026)},`);
            html = html.replace(/(label:\s*'2025[^']*',\s*data:\s*)\[[^\]]*\],/g,
                `$1${JSON.stringify(monthlyLF2025)},`);

            return html;
        });
    });
} else {
    console.log('  ℹ️  airports/ 目錄不存在，跳過');
}

// ═══════════════════════════════════════════════════════════════════════
// 3. 主要航空頁 (airlines/ 目錄下所有 index.html)
// ═══════════════════════════════════════════════════════════════════════
const airlinesDir = path.join(__dirname, '..', 'airlines');
console.log('\n[3/3] 更新主要航空頁...');

if (fs.existsSync(airlinesDir)) {
    const airlineFolders = fs.readdirSync(airlinesDir).filter(f =>
        fs.statSync(path.join(airlinesDir, f)).isDirectory()
    );

    airlineFolders.forEach(folder => {
        const filePath = path.join(airlinesDir, folder, 'index.html');
        updateFile(filePath, html => {
            // 日期更新
            html = html.replace(/更新時間[：:][^\s<&]*/g, `更新時間：${todayString}`);
            html = html.replace(/dateModified['"]\s*:\s*['"][^'"]+['"]/g, `"dateModified": "${todayString}"`);
            html = html.replace(/<time datetime="[^"]*">更新：[^<]*<\/time>/g,
                `<time datetime="${todayString}">更新：${todayString}</time>`);

            // 統計期間
            html = html.replace(/1-\d+ 月/g, `${period} 月`);
            html = html.replace(/1-\d+月/g, `${period}月`);

            // 找到對應航司
            const matchedAirline = sortedAirlines.find(a =>
                html.includes(a.name)
            );

            if (matchedAirline) {
                const al = matchedAirline;
                const share = (al.passengers / stats2026.passengers * 100).toFixed(1);
                // 旅客量
                html = html.replace(/(旅客量[^：：]*[：：]\s*)[\d,]+/g,
                    `$1${al.passengers.toLocaleString()}`);
                // 載客率
                html = html.replace(/(平均載客率|載客率)[^：：]*[：：]\s*)[\d.]+%/g,
                    `$1${al.lf.toFixed(1)}%`);
                // 航班數
                html = html.replace(/(航班數[^：：]*[：：]\s*)[\d,]+/g,
                    `$1${al.flights.toLocaleString()}`);
            }

            // 月份趨勢圖
            html = html.replace(/(labels:\s*)\[(?:"[^"]*"(?:,\s*"[^"]*")*)\],/g,
                `$1${JSON.stringify(monthlyLabels)},`);
            html = html.replace(/(label:\s*'2026[^']*',\s*data:\s*)\[[^\]]*\],/g,
                `$1${JSON.stringify(monthlyLF2026)},`);
            html = html.replace(/(label:\s*'2025[^']*',\s*data:\s*)\[[^\]]*\],/g,
                `$1${JSON.stringify(monthlyLF2025)},`);

            return html;
        });
    });
} else {
    console.log('  ℹ️  airlines/ 目錄不存在，跳過');
}

console.log(`\n🎉 更新完成！統計期間：2026 年 ${period} 月（${todayString}）`);
console.log('⚠️  insights/2026-taiwan-aviation-market-outlook/index.html 已凍結，未更新。');
