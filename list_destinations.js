const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');

// Remove "const" so it assigns to the global scope (sandbox)
code = code.replace('const flightData =', 'flightData =');

const sandbox = { flightData: null };
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

const destinations = new Set();

// Structure: flightData[Category][DepartureAirport][Destination][Airline] = Array of records
for (const category in flightData) {
    const airports = flightData[category];
    for (const airport in airports) {
        const dests = airports[airport];
        for (const dest in dests) {
            destinations.add(dest);
        }
    }
}

console.log("Unique Destinations:", Array.from(destinations).sort());
