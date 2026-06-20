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

const years = new Set();
const months = new Set();
const airlines = new Set();

for (const category in flightData) {
    const airports = flightData[category];
    for (const origin in airports) {
        const dests = airports[origin];
        for (const dest in dests) {
            const airlinesInDest = dests[dest];
            for (const airline in airlinesInDest) {
                airlines.add(airline);
                const records = airlinesInDest[airline];
                records.forEach(r => {
                    years.add(r.year);
                    months.add(r.month);
                });
            }
        }
    }
}

console.log("Years found:", Array.from(years));
console.log("Months found:", Array.from(months).sort((a, b) => a - b));
console.log("Airlines found:", Array.from(airlines));
