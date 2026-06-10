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

const origins = {}; // { origin: { p, s } }

for (const cat in flightData) {
    for (const origin in flightData[cat]) {
        if (!origins[origin]) origins[origin] = { p: 0, s: 0 };
        for (const dest in flightData[cat][origin]) {
            // Check if Japan
            for (const airline in flightData[cat][origin][dest]) {
                flightData[cat][origin][dest][airline].forEach(r => {
                    if (r.year === 2025 && r.month === 11) {
                        // We need a way to check if dest is Japan here too
                        // Let's just use the destination names we know
                        const japanDests = ["東京成田", "大阪", "沖繩", "東京羽田", "福岡", "札幌", "名古屋", "仙台", "熊本", "神戶", "高松", "岡山", "小松", "函館", "廣島", "松山", "青森", "鹿兒島", "佐賀", "高知", "花卷", "秋田", "大分", "旭川", "福島", "新潟", "米子", "宮崎"];
                        if (japanDests.includes(dest)) {
                            origins[origin].p += r.passengers;
                            origins[origin].s += r.seats;
                        }
                    }
                });
            }
        }
    }
}

console.log(JSON.stringify(origins, null, 2));
