const { flightData, DESTINATION_MAP } = require('./data/flight_data_new.js');

console.log('Calculating Japan statistics for 2025 (Jan-Oct)...');

let totalSeats = 0;
let totalPassengers = 0;
const destCounts = {};

const targetYear = 2025;
const startMonth = 1;
const endMonth = 10;

for (const airport in flightData['所有']) {
    const destinations = flightData['所有'][airport];
    for (const dest in destinations) {
        // Check if destination is in Japan
        const destInfo = DESTINATION_MAP[dest];
        if (!destInfo || destInfo.country !== '日本') continue;

        const airlines = destinations[dest];
        for (const airline in airlines) {
            const records = airlines[airline];
            records.forEach(record => {
                if (record.year === targetYear && record.month >= startMonth && record.month <= endMonth) {
                    totalSeats += record.seats;
                    totalPassengers += record.passengers;

                    if (!destCounts[dest]) destCounts[dest] = 0;
                    destCounts[dest] += record.passengers;
                }
            });
        }
    }
}

console.log(`\n--- Japan Market Overview (Jan-Oct 2025) ---`);
console.log(`Total Seats: ${totalSeats.toLocaleString()} (${(totalSeats / 10000).toFixed(2)} 萬)`);
console.log(`Total Passengers: ${totalPassengers.toLocaleString()} (${(totalPassengers / 10000).toFixed(2)} 萬)`);

console.log(`\n--- Top Japan Destinations (Jan-Oct 2025) ---`);
const sortedDestinations = Object.entries(destCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

sortedDestinations.forEach(([dest, count]) => {
    console.log(`${dest}: ${count.toLocaleString()} (${(count / 10000).toFixed(1)} 萬)`);
});
