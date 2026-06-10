const { flightData } = require('./data/flight_data_new.js');

console.log('Verifying Ishigaki data for 2025-01...');

let found = false;
const targetYear = 2025;
const targetMonth = 1;
const targetDest = '石垣島';

for (const airport in flightData['所有']) {
    const destinations = flightData['所有'][airport];
    if (destinations[targetDest]) {
        const airlines = destinations[targetDest];
        for (const airline in airlines) {
            const records = airlines[airline];
            records.forEach(record => {
                if (record.year === targetYear && record.month === targetMonth) {
                    console.log(`\nAirport: ${airport}`);
                    console.log(`Destination: ${targetDest}`);
                    console.log(`Airline: ${airline}`);
                    console.log(`Flights: ${record.flights}`);
                    console.log(`Seats: ${record.seats}`);
                    console.log(`Passengers: ${record.passengers}`);
                    console.log(`Load Factor: ${(record.passengers / record.seats * 100).toFixed(2)}%`);
                    found = true;
                }
            });
        }
    }
}

if (!found) {
    console.log('No data found for Ishigaki in Jan 2025.');
}
