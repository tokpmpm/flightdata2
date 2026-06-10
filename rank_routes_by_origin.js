const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');
code = code.replace('const flightData =', 'flightData =');
const sandbox = { flightData: null };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const flightData = sandbox.flightData;

const japanDests = ["東京成田", "大阪", "沖繩", "東京羽田", "福岡", "札幌", "名古屋", "仙台", "熊本", "神戶", "高松", "岡山", "小松", "函館", "廣島", "松山", "青森", "鹿兒島", "佐賀", "高知", "花卷", "秋田", "大分", "旭川", "福島", "新潟", "米子", "宮崎", "茨城", "富山", "北九州", "靜岡", "石垣島", "下地島"];
function isJapan(dest) {
    return japanDests.includes(dest);
}

const stats = {}; // { "Origin-Dest": { origin, dest, nov25: {p, s}, nov24: {p, s} } }

for (const cat in flightData) {
    for (const origin in flightData[cat]) {
        for (const dest in flightData[cat][origin]) {
            if (!isJapan(dest)) continue;

            const key = `${origin}-${dest}`;
            if (!stats[key]) {
                stats[key] = {
                    origin,
                    dest,
                    nov25: { p: 0, s: 0 },
                    nov24: { p: 0, s: 0 }
                };
            }

            for (const airline in flightData[cat][origin][dest]) {
                const records = flightData[cat][origin][dest][airline];
                records.forEach(r => {
                    if (r.year === 2025 && r.month === 11) {
                        stats[key].nov25.p += r.passengers;
                        stats[key].nov25.s += r.seats;
                    }
                    if (r.year === 2024 && r.month === 11) {
                        stats[key].nov24.p += r.passengers;
                        stats[key].nov24.s += r.seats;
                    }
                });
            }
        }
    }
}

const results = Object.entries(stats).map(([key, data]) => {
    const lf25 = data.nov25.s > 0 ? (data.nov25.p / data.nov25.s * 100) : 0;
    const lf24 = data.nov24.s > 0 ? (data.nov24.p / data.nov24.s * 100) : 0;

    return {
        origin: data.origin,
        dest: data.dest,
        nov25_lf: lf25,
        nov24_lf: lf24,
        lf_yoy_diff: lf25 - lf24,
        passengers_nov25: data.nov25.p,
        passengers_nov24: data.nov24.p,
        volume_yoy_pct: data.nov24.p > 0 ? ((data.nov25.p - data.nov24.p) / data.nov24.p * 100) : null
    };
}).filter(r => r.passengers_nov25 > 0);

// Group by origin
const byOrigin = {};
results.forEach(r => {
    if (!byOrigin[r.origin]) byOrigin[r.origin] = [];
    byOrigin[r.origin].push(r);
});

// For each origin, sort and get top 5 / bottom 5
const output = {};
for (const origin in byOrigin) {
    const routes = byOrigin[origin].sort((a, b) => b.nov25_lf - a.nov25_lf);
    output[origin] = {
        top5: routes.slice(0, 5).map(r => ({
            dest: r.dest,
            lf25: r.nov25_lf.toFixed(1) + '%',
            lf_yoy: (r.lf_yoy_diff >= 0 ? '+' : '') + r.lf_yoy_diff.toFixed(1) + '%',
            pax25: r.passengers_nov25,
            pax_yoy: r.volume_yoy_pct !== null ? ((r.volume_yoy_pct >= 0 ? '+' : '') + r.volume_yoy_pct.toFixed(1) + '%') : 'New'
        })),
        bottom5: routes.slice(-5).reverse().map(r => ({
            dest: r.dest,
            lf25: r.nov25_lf.toFixed(1) + '%',
            lf_yoy: (r.lf_yoy_diff >= 0 ? '+' : '') + r.lf_yoy_diff.toFixed(1) + '%',
            pax25: r.passengers_nov25,
            pax_yoy: r.volume_yoy_pct !== null ? ((r.volume_yoy_pct >= 0 ? '+' : '') + r.volume_yoy_pct.toFixed(1) + '%') : 'New'
        }))
    };
}

console.log(JSON.stringify(output, null, 2));
