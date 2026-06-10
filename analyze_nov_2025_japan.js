const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');

// Prepare sandbox
code = code.replace('const flightData =', 'flightData =');
code = code.replace('const DESTINATION_MAP =', 'DESTINATION_MAP =');
const sandbox = { flightData: null, DESTINATION_MAP: null };
vm.createContext(sandbox);

try {
    vm.runInContext(code, sandbox);
} catch (e) {
    console.error("Error executing code in VM:", e);
    process.exit(1);
}

const flightData = sandbox.flightData;
const DESTINATION_MAP = sandbox.DESTINATION_MAP;

function isJapan(dest) {
    const info = DESTINATION_MAP[dest];
    return info && info.country === '日本';
}

const stats = {}; // { "Origin-Dest": { nov25: {p, s}, nov24: {p, s}, past3m: {p, s} } }

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
                    nov24: { p: 0, s: 0 },
                    past3m: { p: 0, s: 0 }
                };
            }

            for (const airline in flightData[cat][origin][dest]) {
                const records = flightData[cat][origin][dest][airline];
                records.forEach(r => {
                    // Nov 2025
                    if (r.year === 2025 && r.month === 11) {
                        stats[key].nov25.p += r.passengers;
                        stats[key].nov25.s += r.seats;
                    }
                    // Nov 2024
                    if (r.year === 2024 && r.month === 11) {
                        stats[key].nov24.p += r.passengers;
                        stats[key].nov24.s += r.seats;
                    }
                    // Past 3 months (Aug - Oct 2025)
                    if (r.year === 2025 && r.month >= 8 && r.month <= 10) {
                        stats[key].past3m.p += r.passengers;
                        stats[key].past3m.s += r.seats;
                    }
                });
            }
        }
    }
}

const results = Object.entries(stats).map(([key, data]) => {
    const lf25 = data.nov25.s > 0 ? (data.nov25.p / data.nov25.s * 100) : 0;
    const lf24 = data.nov24.s > 0 ? (data.nov24.p / data.nov24.s * 100) : 0;
    const lfPast3m = data.past3m.s > 0 ? (data.past3m.p / data.past3m.s * 100) : 0;

    return {
        key,
        origin: data.origin,
        dest: data.dest,
        nov25_lf: lf25.toFixed(1),
        nov24_lf: lf24.toFixed(1),
        past3m_avg_lf: lfPast3m.toFixed(1),
        yoy_diff: (lf25 - lf24).toFixed(1),
        mom_diff: (lf25 - lfPast3m).toFixed(1),
        passengers_nov25: data.nov25.p,
        passengers_nov24: data.nov24.p,
        volume_change: data.nov24.p > 0 ? ((data.nov25.p - data.nov24.p) / data.nov24.p * 100).toFixed(1) : 'New'
    };
}).filter(r => r.passengers_nov25 > 0 || r.passengers_nov24 > 0)
    .sort((a, b) => b.passengers_nov25 - a.passengers_nov25);

console.log(JSON.stringify(results, null, 2));
