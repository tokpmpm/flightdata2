const { flightData } = require('./data/flight_data_new.js');

console.log('Verifying Osaka and Tokyo data for 2025-01...');

const targetYear = 2025;
const targetMonth = 1;
const targets = ['大阪', '東京成田'];

targets.forEach(targetDest => {
    console.log(`\n--- Checking ${targetDest} ---`);
    let found = false;
    for (const airport in flightData['所有']) {
        const destinations = flightData['所有'][airport];
        if (destinations[targetDest]) {
            const airlines = destinations[targetDest];
            for (const airline in airlines) {
                const records = airlines[airline];
                records.forEach(record => {
                    if (record.year === targetYear && record.month === targetMonth) {
                        console.log(`Airport: ${airport} | Airline: ${airline} | Flights: ${record.flights} | Seats: ${record.seats} | Passengers: ${record.passengers}`);
                        found = true;
                    }
                });
            }
        }
    }
    if (!found) console.log(`No data found for ${targetDest}`);
});
