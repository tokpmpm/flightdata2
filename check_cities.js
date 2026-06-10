const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');
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

const knownJapanCities = [
    '下地島', '仙台', '佐賀', '北九州', '名古屋', '大分', '大阪',
    '宮崎', '富山', '小松', '岡山', '廣島', '旭川', '札幌',
    '東京成田', '東京羽田', '松山', '沖繩', '熊本', '琉球',
    '石垣島', '神戶', '福岡', '福島', '秋田', '米子', '花卷',
    '茨城', '高松', '鹿兒島', '靜岡', '函館', '新潟'
];

const allDestinations = new Set();
const potentialMisses = [];

for (const category in flightData) {
    const airports = flightData[category];
    for (const departure in airports) {
        const dests = airports[departure];
        for (const dest in dests) {
            allDestinations.add(dest);
            if (!knownJapanCities.includes(dest)) {
                // Heuristic: check if it looks like a Japanese city name (often 2-3 chars, but hard to say strictly)
                // We'll just list EVERYTHING not in our list that has significant traffic to Japan-like places?
                // Actually, let's just list all destinations and I'll manually check the output.
            }
        }
    }
}

console.log("All Destinations:", Array.from(allDestinations).sort());
