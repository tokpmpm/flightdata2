const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '../data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');

// Remove "const" so it assigns to the global scope (sandbox)
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

if (!flightData) {
    console.error("flightData not found in sandbox");
    process.exit(1);
}

const routeStats = {};

// Structure: flightData[Category][DepartureAirport][Destination][Airline] = Array of records
for (const category in flightData) {
    const airports = flightData[category];
    for (const origin in airports) {
        const dests = airports[origin];
        for (const dest in dests) {
            const airlines = dests[dest];
            for (const airline in airlines) {
                const records = airlines[airline];

                // Filter for Japan routes only
                const destInfo = DESTINATION_MAP[dest];
                if (!destInfo || destInfo.country !== '日本') {
                    continue;
                }

                records.forEach(r => {
                    // Summer vacation: July & August
                    if (r.year === 2025 && (r.month === 7 || r.month === 8)) {
                        const key = `${origin}-${dest}`;
                        if (!routeStats[key]) {
                            routeStats[key] = {
                                origin,
                                dest,
                                passengers: 0,
                                seats: 0
                            };
                        }
                        routeStats[key].passengers += r.passengers;
                        routeStats[key].seats += r.seats;
                    }
                });
            }
        }
    }
}

const results = [];
for (const key in routeStats) {
    const stat = routeStats[key];
    if (stat.seats > 0) {
        const lf = (stat.passengers / stat.seats) * 100;
        results.push({
            route: key,
            origin: stat.origin,
            dest: stat.dest,
            passengers: stat.passengers,
            seats: stat.seats,
            loadFactor: lf
        });
    }
}

// Sort by load factor (descending)
results.sort((a, b) => b.loadFactor - a.loadFactor);

console.log("================================================================");
console.log("2025年暑假 (7-8月) 載客率最高 (人擠人) Top 10 - 日本航線");
console.log("================================================================");
results.slice(0, 15).forEach((r, i) => {
    console.log(`${i + 1}. ${r.route} | 載客率: ${r.loadFactor.toFixed(2)}% | 載客數: ${r.passengers} | 座位數: ${r.seats}`);
});

console.log("\n================================================================");
console.log("2025年暑假 (7-8月) 載客率最低 (最空好躺) Top 10 - 日本航線 (過濾座位數少於1000)");
console.log("================================================================");
results.filter(r => r.seats >= 1000).sort((a, b) => a.loadFactor - b.loadFactor).slice(0, 15).forEach((r, i) => {
    console.log(`${i + 1}. ${r.route} | 載客率: ${r.loadFactor.toFixed(2)}% | 載客數: ${r.passengers} | 座位數: ${r.seats}`);
});
