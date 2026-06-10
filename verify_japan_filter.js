const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
console.log(`Loading data from: ${dataPath}`);
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

if (!flightData || !DESTINATION_MAP) {
    console.error("Data not loaded correctly.");
    process.exit(1);
}

const includedDestinations = new Set();
const excludedDestinations = new Set();
const unmappedDestinations = new Set();

// Iterate through flightData to find all destinations
for (const category in flightData) {
    const airports = flightData[category];
    for (const origin in airports) {
        const dests = airports[origin];
        for (const dest in dests) {
            const info = DESTINATION_MAP[dest];
            if (!info) {
                unmappedDestinations.add(dest);
            } else if (info.country === '日本') {
                includedDestinations.add(dest);
            } else {
                excludedDestinations.add(`${dest} (${info.country})`);
            }
        }
    }
}

console.log("\n=== ✅ Included Japan Destinations (Japan Only) ===");
console.log(Array.from(includedDestinations).sort().join(', '));

if (unmappedDestinations.size > 0) {
    console.log("\n=== ⚠️ Unmapped Destinations (Check if any are Japan) ===");
    console.log(Array.from(unmappedDestinations).sort().join(', '));
} else {
    console.log("\n=== ✨ All destinations are mapped. ===");
}

console.log("\n=== ❌ Excluded Destinations (Sample) ===");
console.log(Array.from(excludedDestinations).sort().slice(0, 10).join(', '));
console.log(`... and ${excludedDestinations.size - 10} more.`);
