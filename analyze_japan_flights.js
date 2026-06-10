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
    return { flights: 0, seats: 0, passengers: 0, airlines: {} };
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
                        if (year === 2024 || year === 2025) {
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

                            if (!cityStats.airlines[airline]) {
                                cityStats.airlines[airline] = { flights: 0, seats: 0, passengers: 0 };
                            }
                            cityStats.airlines[airline].flights += record.flights;
                            cityStats.airlines[airline].seats += record.seats;
                            cityStats.airlines[airline].passengers += record.passengers;
                        }
                    }
                }
            }
        }
    }
}

// Calculate growth and load factors
const report = {
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

    const cityReport = {
        name: city,
        2024: {
            flights: stats2024.flights,
            seats: stats2024.seats,
            passengers: stats2024.passengers,
            loadFactor: stats2024.seats > 0 ? (stats2024.passengers / stats2024.seats * 100).toFixed(2) + '%' : '0%'
        },
        2025: {
            flights: stats2025.flights,
            seats: stats2025.seats,
            passengers: stats2025.passengers,
            loadFactor: stats2025.seats > 0 ? (stats2025.passengers / stats2025.seats * 100).toFixed(2) + '%' : '0%'
        },
        growth: {
            flights: stats2024.flights > 0 ? ((stats2025.flights - stats2024.flights) / stats2024.flights * 100).toFixed(2) + '%' : 'N/A',
            seats: stats2024.seats > 0 ? ((stats2025.seats - stats2024.seats) / stats2024.seats * 100).toFixed(2) + '%' : 'N/A',
            passengers: stats2024.passengers > 0 ? ((stats2025.passengers - stats2024.passengers) / stats2024.passengers * 100).toFixed(2) + '%' : 'N/A'
        }
    };
    report.cities.push(cityReport);
}

// Sort cities by 2025 passenger count descending
report.cities.sort((a, b) => b[2025].passengers - a[2025].passengers);

console.log(JSON.stringify(report, null, 2));
