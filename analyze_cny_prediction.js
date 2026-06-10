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

// Known Japan cities
const japanCities = [
    '下地島', '仙台', '佐賀', '北九州', '名古屋', '大分', '大阪',
    '宮崎', '富山', '小松', '岡山', '廣島', '旭川', '札幌',
    '東京成田', '東京羽田', '松山', '沖繩', '熊本', '琉球',
    '石垣島', '神戶', '福岡', '福島', '秋田', '米子', '花卷',
    '茨城', '高松', '鹿兒島', '靜岡', '函館', '新潟'
];

const routes = {};

function initRoute(dept, dest, airline) {
    const key = `${dept}-${dest}-${airline}`;
    if (!routes[key]) {
        routes[key] = {
            dept, dest, airline,
            cny: { seats: 0, passengers: 0 }, // 2024/11 - 2025/02
            recent: { seats: 0, passengers: 0 } // 2025/01 - 2025/10
        };
    }
    return routes[key];
}

for (const category in flightData) {
    const airports = flightData[category];
    for (const departure in airports) {
        const dests = airports[departure];
        for (const dest in dests) {
            if (!japanCities.includes(dest)) continue;

            const airlines = dests[dest];
            for (const airline in airlines) {
                const records = airlines[airline];
                const route = initRoute(departure, dest, airline);

                records.forEach(r => {
                    // CNY Period: Strictly 2025/01, 2025/02
                    if (r.year === 2025 && (r.month === 1 || r.month === 2)) {
                        route.cny.seats += r.seats;
                        route.cny.passengers += r.passengers;
                    }

                    // Recent Trend: 2025/01 - 2025/10 (Keep as is for context)
                    if (r.year === 2025 && r.month >= 1 && r.month <= 10) {
                        route.recent.seats += r.seats;
                        route.recent.passengers += r.passengers;
                    }
                });
            }
        }
    }
}

const analysis = Object.values(routes)
    .filter(r => r.cny.seats > 0) // Must have data for previous CNY
    .map(r => {
        const cnyLF = r.cny.seats > 0 ? (r.cny.passengers / r.cny.seats * 100) : 0;
        const recentLF = r.recent.seats > 0 ? (r.recent.passengers / r.recent.seats * 100) : 0;
        return {
            ...r,
            cnyLF,
            recentLF,
            cnySeats: r.cny.seats,
            recentSeats: r.recent.seats
        };
    })
    .sort((a, b) => a.cnyLF - b.cnyLF); // Sort by lowest CNY Load Factor (Best chance for discount)

console.log(JSON.stringify(analysis, null, 2));
