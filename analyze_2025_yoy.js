const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('./data/flight_data_new.js', 'utf8');
code = code.replace('const flightData =', 'flightData =');
const sandbox = { flightData: null };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const fd = sandbox.flightData;

// 1. 各航空 2025 vs 2024
const airlineStats = {};
// 2. 桃園、高雄、台中 航線
const routeStats = {};

const TARGET_ORIGINS = ['桃園', '高雄', '台中'];

for (const cat in fd) {
    for (const originFull in fd[cat]) {
        let origin = originFull;
        if (originFull.includes('桃園')) origin = '桃園';
        else if (originFull.includes('高雄')) origin = '高雄';
        else if (originFull.includes('台中')) origin = '台中';
        else if (originFull.includes('松山')) origin = '松山';

        for (const dest in fd[cat][originFull]) {
            const routeKey = `${origin}-${dest}`;

            for (const airline in fd[cat][originFull][dest]) {
                if (!airlineStats[airline]) {
                    airlineStats[airline] = { pax2025: 0, pax2024: 0 };
                }

                if (TARGET_ORIGINS.includes(origin)) {
                    if (!routeStats[routeKey]) {
                        routeStats[routeKey] = { origin, dest, pax2025: 0, pax2024: 0 };
                    }
                }

                fd[cat][originFull][dest][airline].forEach(r => {
                    if (r.year === 2025) {
                        airlineStats[airline].pax2025 += r.passengers;
                        if (TARGET_ORIGINS.includes(origin)) {
                            routeStats[routeKey].pax2025 += r.passengers;
                        }
                    } else if (r.year === 2024) {
                        airlineStats[airline].pax2024 += r.passengers;
                        if (TARGET_ORIGINS.includes(origin)) {
                            routeStats[routeKey].pax2024 += r.passengers;
                        }
                    }
                });
            }
        }
    }
}

// Prepare Airline output
const airlineArr = Object.entries(airlineStats).map(([airline, stat]) => {
    const diff = stat.pax2025 - stat.pax2024;
    const ratio = stat.pax2024 > 0 ? (diff / stat.pax2024 * 100).toFixed(2) + '%' : 'N/A';
    return { airline, ...stat, diff, ratio };
}).sort((a, b) => b.diff - a.diff);

console.log('=== 各航空2025年載客人數 YoY 增加狀態 ===');
console.table(airlineArr);

// Prepare Route output
const routeArr = Object.entries(routeStats).map(([route, stat]) => {
    const diff = stat.pax2025 - stat.pax2024;
    const ratio = stat.pax2024 > 0 ? (diff / stat.pax2024 * 100).toFixed(2) + '%' : 'N/A';
    return { route, ...stat, diff, ratio };
}).sort((a, b) => b.diff - a.diff);

console.log('\n=== 桃園、高雄、台中 增加最多的前五大航線 (合併計算) ===');
console.table(routeArr.slice(0, 5).map(r => ({
    '航線': r.route,
    '2025載客': r.pax2025,
    '2024載客': r.pax2024,
    '增加人數': r.diff,
    '增加比例': r.ratio
})));

TARGET_ORIGINS.forEach(orig => {
    const cityRoutes = routeArr.filter(r => r.origin === orig).slice(0, 5);
    console.log(`\n=== ${orig} 增加最多的前五大航線 ===`);
    console.table(cityRoutes.map(r => ({
        '航線': r.route,
        '2025載客': r.pax2025,
        '2024載客': r.pax2024,
        '增加人數': r.diff,
        '增加比例': r.ratio
    })));
});
