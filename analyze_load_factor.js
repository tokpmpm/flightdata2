const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
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

if (!flightData) {
    console.error("flightData not found in sandbox");
    process.exit(1);
}

const routes = [];

// Structure: flightData[Category][DepartureAirport][Destination][Airline] = Array of records
for (const category in flightData) {
    const airports = flightData[category];
    for (const origin in airports) {
        const dests = airports[origin];
        for (const dest in dests) {
            const airlines = dests[dest];
            for (const airline in airlines) {
                const records = airlines[airline];

                // Calculate metrics
                let cnyPassengers = 0;
                let cnySeats = 0;
                let normalPassengers = 0;
                let normalSeats = 0;

                // Filter for Japan routes only
                const destInfo = sandbox.DESTINATION_MAP[dest];
                if (!destInfo || destInfo.country !== '日本') {
                    // console.log(`Skipping ${dest}: ${destInfo ? destInfo.country : 'No Info'}`);
                    continue;
                } else {
                    console.log(`Including ${dest}: ${destInfo.country}`);
                }

                records.forEach(r => {
                    // CNY: 2025 Jan-Feb
                    if (r.year === 2025 && (r.month === 1 || r.month === 2)) {
                        cnyPassengers += r.passengers;
                        cnySeats += r.seats;
                    }

                    // Normal: 2025 Jan-Oct
                    if (r.year === 2025 && r.month >= 1 && r.month <= 10) {
                        normalPassengers += r.passengers;
                        normalSeats += r.seats;
                    }
                });

                if (cnySeats > 0 && normalSeats > 0) {
                    const cnyLF = (cnyPassengers / cnySeats) * 100;
                    const normalLF = (normalPassengers / normalSeats) * 100;

                    routes.push({
                        origin,
                        dest,
                        airline,
                        cnyLF,
                        normalLF,
                        diff: cnyLF - normalLF
                    });
                }
            }
        }
    }
}

// Sort by CNY Load Factor (Descending) for Top 10
routes.sort((a, b) => b.cnyLF - a.cnyLF);
const top10 = routes.slice(0, 10);

// Sort by CNY Load Factor (Ascending) for Bottom 10 (Worst)
// Filter out routes with very low seat count if necessary, but for now take all
routes.sort((a, b) => a.cnyLF - b.cnyLF);
const bottom10 = routes.slice(0, 10);

console.log("================================================================");
console.log("載客率王 Top 10 (2025 春節) - 日本航線限定");
console.log("================================================================");
top10.forEach((r, i) => {
    console.log(`${i + 1}. ${r.origin} - ${r.dest} | ${r.airline}`);
    console.log(`   - 過年載客率: ${r.cnyLF.toFixed(2)}%`);
    console.log(`   - 平時載客率: ${r.normalLF.toFixed(2)}%`);
});

console.log("\n================================================================");
console.log("還有空位 (載客率最低) Top 10 (2025 春節) - 日本航線限定");
console.log("================================================================");
bottom10.forEach((r, i) => {
    console.log(`${i + 1}. ${r.origin} - ${r.dest} | ${r.airline}`);
    console.log(`   - 過年載客率: ${r.cnyLF.toFixed(2)}%`);
    console.log(`   - 平時載客率: ${r.normalLF.toFixed(2)}%`);
});
