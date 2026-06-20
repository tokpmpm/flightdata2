const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '../data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');

code = code.replace('const flightData =', 'flightData =');
code = code.replace('const DESTINATION_MAP =', 'DESTINATION_MAP =');

const sandbox = { flightData: null, DESTINATION_MAP: null };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const flightData = sandbox.flightData;

const targetAirlines = ['長榮', '中華', '星宇', '台灣虎航'];
const airlineStats = {};

targetAirlines.forEach(a => {
    airlineStats[a] = { passengers: 0, seats: 0 };
});

for (const category in flightData) {
    const airports = flightData[category];
    for (const origin in airports) {
        const dests = airports[origin];
        for (const dest in dests) {
            const airlinesInDest = dests[dest];
            for (const airline in airlinesInDest) {
                if (targetAirlines.includes(airline)) {
                    const records = airlinesInDest[airline];
                    records.forEach(r => {
                        if (r.year === 2026 && (r.month === 1 || r.month === 2 || r.month === 3)) {
                            airlineStats[airline].passengers += r.passengers;
                            airlineStats[airline].seats += r.seats;
                        }
                    });
                }
            }
        }
    }
}

console.log("2026 Jan-Mar Stats:");
for (const airline in airlineStats) {
    const stats = airlineStats[airline];
    const lf = stats.seats > 0 ? (stats.passengers / stats.seats) * 100 : 0;
    console.log(`${airline}:`);
    console.log(`  Passengers: ${stats.passengers}`);
    console.log(`  Seats: ${stats.seats}`);
    console.log(`  Load Factor: ${lf.toFixed(4)}%`);
}
