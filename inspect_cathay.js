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

const targets = [
    { dept: '桃園國際機場', dest: '大阪', airline: '國泰' },
    { dept: '桃園國際機場', dest: '東京成田', airline: '國泰' }
];

console.log("--- Cathay Pacific Monthly Breakdown (Jan-Feb 2025) ---");

targets.forEach(t => {
    const records = flightData['所有'][t.dept][t.dest][t.airline];
    console.log(`\nRoute: ${t.dept} -> ${t.dest} (${t.airline})`);
    records.forEach(r => {
        if (r.year === 2025 && (r.month === 1 || r.month === 2)) {
            const lf = (r.passengers / r.seats * 100).toFixed(2) + '%';
            console.log(`  ${r.year}-${r.month.toString().padStart(2, '0')}: Seats ${r.seats}, Pax ${r.passengers}, LF ${lf}`);
        }
    });
});
