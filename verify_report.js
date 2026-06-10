// Verify the generated passenger capacity report (e.g. 2025_yoy_analysis_report.md)
// against the raw data structure `flight_data_new.js`.
//
// Usage: node verify_report.js
const fs = require('fs');
const vm = require('vm');

function runVerification() {
    console.log('=== 開始驗證載客數據 !===');

    // 1. Load Raw Data
    let code;
    try {
        code = fs.readFileSync('./data/flight_data_new.js', 'utf8');
    } catch (e) {
        console.error('❌ 無法讀取 ./data/flight_data_new.js，請確認檔案存在');
        process.exit(1);
    }

    code = code.replace('const flightData =', 'flightData =');
    const sandbox = { flightData: null };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    const fd = sandbox.flightData;

    // 2. Initialize Counters
    let globalTotal25 = 0;
    let globalTotal24 = 0;

    let targetAirlines = {
        '星宇': { year25: 0, year24: 0, expect25: 4983042, expect24: 4070315 },
        '長榮': { year25: 0, year24: 0, expect25: 13508146, expect24: 13275276 }
    };

    let targetRoutes = {
        '高雄-香港': { year25: 0, year24: 0, expect25: 1253468, expect24: 1044058 },
        '桃園-沖繩': { year25: 0, year24: 0, expect25: 1568890, expect24: 1262426 }
    };

    // 3. Traverse Data
    for (const cat in fd) {
        for (const originFull in fd[cat]) {
            let origin = originFull;
            if (originFull.includes('桃園')) origin = '桃園';
            else if (originFull.includes('高雄')) origin = '高雄';
            else if (originFull.includes('台中') || originFull.includes('臺中')) origin = '台中';

            for (const dest in fd[cat][originFull]) {
                const routeKey = `${origin}-${dest}`;

                for (const airline in fd[cat][originFull][dest]) {
                    fd[cat][originFull][dest][airline].forEach(r => {
                        const is2025 = r.year === 2025;
                        const is2024 = r.year === 2024;

                        if (is2025) globalTotal25 += r.passengers;
                        if (is2024) globalTotal24 += r.passengers;

                        // Increment Airline
                        if (targetAirlines[airline]) {
                            if (is2025) targetAirlines[airline].year25 += r.passengers;
                            if (is2024) targetAirlines[airline].year24 += r.passengers;
                        }

                        // Increment Route
                        if (targetRoutes[routeKey]) {
                            if (is2025) targetRoutes[routeKey].year25 += r.passengers;
                            if (is2024) targetRoutes[routeKey].year24 += r.passengers;
                        }
                    });
                }
            }
        }
    }

    // 4. Assertions
    let hasError = false;

    console.log('\n[全域數據]');
    console.log(`2025: ${globalTotal25.toLocaleString()}`);
    console.log(`2024: ${globalTotal24.toLocaleString()}`);

    console.log('\n[航空公司抽樣檢查]');
    Object.entries(targetAirlines).forEach(([name, data]) => {
        const pass25 = data.year25 === data.expect25;
        const pass24 = data.year24 === data.expect24;
        console.log(`${name} 2025: ${data.year25.toLocaleString()} (Expected: ${data.expect25.toLocaleString()}) - ${pass25 ? '✅' : '❌'}`);
        console.log(`${name} 2024: ${data.year24.toLocaleString()} (Expected: ${data.expect24.toLocaleString()}) - ${pass24 ? '✅' : '❌'}`);
        if (!pass25 || !pass24) hasError = true;
    });

    console.log('\n[特定航線抽樣檢查]');
    Object.entries(targetRoutes).forEach(([name, data]) => {
        const pass25 = data.year25 === data.expect25;
        const pass24 = data.year24 === data.expect24;
        console.log(`${name} 2025: ${data.year25.toLocaleString()} (Expected: ${data.expect25.toLocaleString()}) - ${pass25 ? '✅' : '❌'}`);
        console.log(`${name} 2024: ${data.year24.toLocaleString()} (Expected: ${data.expect24.toLocaleString()}) - ${pass24 ? '✅' : '❌'}`);
        if (!pass25 || !pass24) hasError = true;
    });

    // 5. Conclusion
    console.log('\n=============================');
    if (hasError) {
        console.error('❌ 驗證失敗！資料有出入，請檢查彙總腳本與原始資料。');
        process.exit(1);
    } else {
        console.log('✅ 驗證成功！資料彙總邏輯一致。');
        process.exit(0);
    }
}

runVerification();
