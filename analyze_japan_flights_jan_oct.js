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

const japanCities = [
    '下地島', '仙台', '佐賀', '北九州', '名古屋', '大分', '大阪',
    '宮崎', '富山', '小松', '岡山', '廣島', '旭川', '札幌',
    '東京成田', '東京羽田', '松山', '沖繩', '熊本', '琉球',
    '石垣島', '神戶', '福岡', '福島', '秋田', '米子', '花卷',
    '茨城', '高松', '鹿兒島', '靜岡', '函館', '新潟'
];

const analysis = {
    2024: { totalFlights: 0, totalSeats: 0, totalPassengers: 0, byCity: {} },
    2025: { totalFlights: 0, totalSeats: 0, totalPassengers: 0, byCity: {} }
};

function initCityStats() {
    return { flights: 0, seats: 0, passengers: 0 };
}

for (const category in flightData) {
    const airports = flightData[category];
    for (const departure in airports) {
        const dests = airports[departure];
        for (const dest in dests) {
            if (japanCities.includes(dest)) {
                const airlines = dests[dest];
                for (const airline in airlines) {
                    const records = airlines[airline];
                    for (const record of records) {
                        const year = record.year;
                        const month = record.month;

                        // Filter for 2024 and 2025, Jan (1) to Oct (10) only
                        if ((year === 2024 || year === 2025) && month >= 1 && month <= 10) {
                            const stats = analysis[year];
                            stats.totalFlights += record.flights;
                            stats.totalSeats += record.seats;
                            stats.totalPassengers += record.passengers;

                            if (!stats.byCity[dest]) {
                                stats.byCity[dest] = initCityStats();
                            }
                            const cityStats = stats.byCity[dest];
                            cityStats.flights += record.flights;
                            cityStats.seats += record.seats;
                            cityStats.passengers += record.passengers;
                        }
                    }
                }
            }
        }
    }
}

// Calculate growth and load factors
const report = {
    period: "Jan-Oct",
    overall: {},
    cities: []
};

// Overall comparison
report.overall = {
    2024: {
        flights: analysis[2024].totalFlights,
        seats: analysis[2024].totalSeats,
        passengers: analysis[2024].totalPassengers,
        loadFactor: (analysis[2024].totalPassengers / analysis[2024].totalSeats * 100).toFixed(2) + '%'
    },
    2025: {
        flights: analysis[2025].totalFlights,
        seats: analysis[2025].totalSeats,
        passengers: analysis[2025].totalPassengers,
        loadFactor: (analysis[2025].totalPassengers / analysis[2025].totalSeats * 100).toFixed(2) + '%'
    },
    growth: {
        flights: ((analysis[2025].totalFlights - analysis[2024].totalFlights) / analysis[2024].totalFlights * 100).toFixed(2) + '%',
        seats: ((analysis[2025].totalSeats - analysis[2024].totalSeats) / analysis[2024].totalSeats * 100).toFixed(2) + '%',
        passengers: ((analysis[2025].totalPassengers - analysis[2024].totalPassengers) / analysis[2024].totalPassengers * 100).toFixed(2) + '%'
    }
};

// City comparison
const allCities = new Set([...Object.keys(analysis[2024].byCity), ...Object.keys(analysis[2025].byCity)]);
for (const city of allCities) {
    const stats2024 = analysis[2024].byCity[city] || initCityStats();
    const stats2025 = analysis[2025].byCity[city] || initCityStats();

    let passengerGrowth = -100; // Default to -100% if 2024 is 0 but 2025 is 0 too? No.
    if (stats2024.passengers > 0) {
        passengerGrowth = (stats2025.passengers - stats2024.passengers) / stats2024.passengers * 100;
    } else if (stats2025.passengers > 0) {
        passengerGrowth = 99999; // Infinite growth (new route)
    } else {
        passengerGrowth = 0; // Both 0
    }

    const cityReport = {
        name: city,
        2024: {
            passengers: stats2024.passengers
        },
        2025: {
            passengers: stats2025.passengers
        },
        growth: {
            passengers: passengerGrowth,
            passengersFormatted: passengerGrowth === 99999 ? 'New' : passengerGrowth.toFixed(2) + '%'
        }
    };
    report.cities.push(cityReport);
}

// Sort cities by 2025 passenger count descending for Top 10
report.top10 = [...report.cities].sort((a, b) => b[2025].passengers - a[2025].passengers).slice(0, 10);

// Sort cities by growth descending for Rising Stars (filter out those with < 10000 passengers in 2024 to ensure stable base)
report.risingStars = [...report.cities]
    .filter(c => c[2024].passengers > 10000)
    .sort((a, b) => b.growth.passengers - a.growth.passengers)
    .slice(0, 10);

// Calculate Load Factors for 2025 (Jan-Oct)
// Filter out very small routes (e.g. < 5000 seats) to avoid outliers
const loadFactorCities = [...report.cities]
    .filter(c => analysis[2025].byCity[c.name] && analysis[2025].byCity[c.name].seats > 5000)
    .map(c => {
        const stats = analysis[2025].byCity[c.name];
        return {
            name: c.name,
            loadFactor: (stats.passengers / stats.seats * 100),
            passengers: stats.passengers,
            seats: stats.seats
        };
    });

report.topLoadFactor = [...loadFactorCities]
    .sort((a, b) => b.loadFactor - a.loadFactor)
    .slice(0, 5)
    .map(c => ({ ...c, loadFactorFormatted: c.loadFactor.toFixed(2) + '%' }));

report.worstLoadFactor = [...loadFactorCities]
    .sort((a, b) => a.loadFactor - b.loadFactor)
    .slice(0, 3)
    .map(c => ({ ...c, loadFactorFormatted: c.loadFactor.toFixed(2) + '%' }));

console.log(JSON.stringify(report, null, 2));
