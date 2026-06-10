const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, 'data/flight_data_new.js');
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

if (!flightData) {
    console.error("flightData not found in sandbox");
    process.exit(1);
}

// Helper to check if destination is in Japan
function isJapan(dest) {
    const info = DESTINATION_MAP[dest];
    return info && info.country === '日本';
}

// Data Aggregation
const destStats = {}; // { dest: { passengers2024: 0, passengers2025: 0, seats2025: 0 } }
const routeAggregates = {}; // Key: "Origin-Dest", Value: { origin, dest, passengers: 0, seats: 0 }

// Iterate through data
for (const category in flightData) {
    const airports = flightData[category];
    for (const origin in airports) {
        const dests = airports[origin];
        for (const dest in dests) {
            if (!isJapan(dest)) continue;

            if (!destStats[dest]) {
                destStats[dest] = { passengers2024: 0, passengers2025: 0, seats2024: 0, seats2025: 0 };
            }

            const airlines = dests[dest];
            for (const airline in airlines) {
                const records = airlines[airline];

                let routePassengers = 0;
                let routeSeats = 0;

                records.forEach(r => {
                    // 2024 Jan-Nov (for growth comparison)
                    if (r.year === 2024 && r.month >= 1 && r.month <= 11) {
                        destStats[dest].passengers2024 += r.passengers;
                        destStats[dest].seats2024 += r.seats;
                    }

                    // 2025 Jan-Nov (Current Period)
                    if (r.year === 2025 && r.month >= 1 && r.month <= 11) {
                        destStats[dest].passengers2025 += r.passengers;
                        destStats[dest].seats2025 += r.seats;
                        routePassengers += r.passengers;
                        routeSeats += r.seats;
                    }
                });

                // Aggregate by Route (Origin - Dest)
                if (routeSeats > 0) {
                    const key = `${origin}-${dest}`;
                    if (!routeAggregates[key]) {
                        routeAggregates[key] = { origin, dest, passengers: 0, seats: 0 };
                    }
                    routeAggregates[key].passengers += routePassengers;
                    routeAggregates[key].seats += routeSeats;
                }
            }
        }
    }
}

// Convert aggregates to array
const routeStats = Object.values(routeAggregates).map(r => ({
    origin: r.origin,
    dest: r.dest,
    lf: (r.passengers / r.seats) * 100
}));

// 1. Top 10 Destinations (Passengers)
const topDestinations = Object.entries(destStats)
    .map(([dest, stats]) => ({ dest, passengers: stats.passengers2025 }))
    .sort((a, b) => b.passengers - a.passengers)
    .slice(0, 10);

// 2. Growth (Rising Stars) - > 10k passengers in 2024
const growthDestinations = Object.entries(destStats)
    .filter(([dest, stats]) => stats.passengers2024 > 10000)
    .map(([dest, stats]) => ({
        dest,
        growth: ((stats.passengers2025 - stats.passengers2024) / stats.passengers2024) * 100
    }))
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 10);

// 3. Load Factor Best 10 (Japan Only) - Aggregated by Route (Origin-Dest-Airline) is too granular for the chart?
// The chart seems to show Destination level or Route level?
// The existing chart shows "下地島", "函館" etc. which implies Destination level aggregation for LF?
// But the user asked for "Top 10" with "Origin Airport".
// Let's stick to the Route level as requested by the user for the analysis, but for the chart, 
// if it's a bar chart, maybe we can label it "Origin - Dest (Airline)" or just "Dest (Airline)" if Origin is implied?
// Actually, looking at the existing chart labels: ['下地島', '函館', ...], it seems to be Destination based.
// However, the user specifically asked to include Taiwan airports in the calculation.
// Let's aggregate by Destination for the chart to keep it clean, OR use the specific routes if they are distinct enough.
// Given the user's request "Top 10 ... 包含台灣機場", they probably want to see specific high-performing routes.
// Let's use the Route level (Origin - Dest) for the Top 10 LF chart.

routeStats.sort((a, b) => b.lf - a.lf);
const top10LF = routeStats.slice(0, 10);

routeStats.sort((a, b) => a.lf - b.lf);
const bottom10LF = routeStats.slice(0, 10);

// 4. Market Overview
const totalSeats2025 = Object.values(destStats).reduce((sum, val) => sum + val.seats2025, 0);
const totalPassengers2025 = Object.values(destStats).reduce((sum, val) => sum + val.passengers2025, 0);
const totalPassengers2024 = Object.values(destStats).reduce((sum, val) => sum + val.passengers2024, 0);
const totalSeats2024 = Object.values(destStats).reduce((sum, val) => sum + val.seats2024, 0);

const passengerGrowth = ((totalPassengers2025 - totalPassengers2024) / totalPassengers2024 * 100).toFixed(1);
const seatsGrowth = ((totalSeats2025 - totalSeats2024) / totalSeats2024 * 100).toFixed(1);

// Helper to shorten airport name
function shortenAirport(name) {
    return name.replace('國際機場', '').replace('清泉崗機場', '清泉崗').replace('機場', '');
}

// Output JSON for charts.html
const output = {
    market: {
        seats: (totalSeats2025 / 10000).toFixed(1),
        passengers: (totalPassengers2025 / 10000).toFixed(1),
        passengerGrowth: passengerGrowth,
        seatsGrowth: seatsGrowth
    },
    topDestinations: {
        labels: topDestinations.map(d => d.dest),
        data: topDestinations.map(d => (d.passengers / 10000).toFixed(1))
    },
    growthDestinations: {
        labels: growthDestinations.map(d => d.dest),
        data: growthDestinations.map(d => d.growth.toFixed(1))
    },
    top10LF: {
        labels: top10LF.map(r => `${shortenAirport(r.origin)}-${r.dest}`),
        data: top10LF.map(r => r.lf.toFixed(1))
    },
    bottom10LF: {
        labels: bottom10LF.map(r => `${shortenAirport(r.origin)}-${r.dest}`),
        data: bottom10LF.map(r => r.lf.toFixed(1))
    },
    kobeStats: {
        passengers2024: (Object.entries(destStats).find(([d]) => d === '神戶')?.[1].passengers2024 || 0),
        passengers2025: (Object.entries(destStats).find(([d]) => d === '神戶')?.[1].passengers2025 || 0)
    }
};

console.log(JSON.stringify(output, null, 2));
