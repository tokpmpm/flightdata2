const { flightData, DESTINATION_MAP } = require('./data/flight_data_new.js');

console.log('Listing all Japan destinations for 2025 (Jan-Oct)...');

const destCounts = {};
const targetYear = 2025;
const startMonth = 1;
const endMonth = 10;

for (const airport in flightData['所有']) {
    const destinations = flightData['所有'][airport];
    for (const dest in destinations) {
        const destInfo = DESTINATION_MAP[dest];
        if (!destInfo || destInfo.country !== '日本') continue;

        const airlines = destinations[dest];
        for (const airline in airlines) {
            const records = airlines[airline];
            records.forEach(record => {
                if (record.year === targetYear && record.month >= startMonth && record.month <= endMonth) {
                    if (!destCounts[dest]) destCounts[dest] = 0;
                    destCounts[dest] += record.passengers;
                }
            });
        }
    }
}

const sortedDestinations = Object.entries(destCounts)
    .sort(([, a], [, b]) => b - a);

sortedDestinations.forEach(([dest, count]) => {
    console.log(`${dest}: ${count.toLocaleString()}`);
});
