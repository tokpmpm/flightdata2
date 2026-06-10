const fs = require('fs');
const path = require('path');

// Read flight_data_new.js and eval it to get flightData
let dataContent = fs.readFileSync('data/flight_data_new.js', 'utf8');
dataContent = dataContent.replace('const flightData =', 'global.flightData =');
eval(dataContent); // This defines global.flightData

console.log('flightData keys:', Object.keys(flightData));
if (flightData["所有"]) {
    console.log('flightData["所有"] keys (first 5):', Object.keys(flightData["所有"]).slice(0, 5));
}

try {
    const flat = [];
    const all = flightData["所有"] || {};
    for (const airport in all) {
        const destinations = all[airport];
        // console.log(`Processing airport: ${airport}`);
        for (const destination in destinations) {
            const airlines = destinations[destination];
            // console.log(`  Processing destination: ${destination}`);
            for (const airlineName in airlines) {
                const records = airlines[airlineName];
                // console.log(`    Processing airline: ${airlineName}, records type: ${typeof records}, isArray: ${Array.isArray(records)}`);

                // The problematic loop
                for (const rec of records) {
                    flat.push(rec);
                }
            }
        }
    }
    console.log(`Successfully processed ${flat.length} records.`);
} catch (error) {
    console.error('Error processing data:', error);
}
