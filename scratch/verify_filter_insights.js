const { flightData } = require('../data/flight_data_new.js');
const { calculateInsightsData } = require('../js/insights.js');

console.log('Verifying customized insights logic on local data...');

// Flatten data
const flat = [];
const all = flightData["所有"] || {};

for (const airportName in all) {
    const destinations = all[airportName];
    for (const destination in destinations) {
        const airlines = destinations[destination];
        for (const airlineName in airlines) {
            const records = airlines[airlineName];
            if (!Array.isArray(records)) continue;
            for (const rec of records) {
                flat.push({
                    year: rec.year,
                    month: rec.month,
                    yearMonth: `${rec.year}-${String(rec.month).padStart(2, '0')}`,
                    airport: airportName,
                    destination,
                    airline: airlineName,
                    flights: rec.flights,
                    totalSeats: rec.seats,
                    passengers: rec.passengers,
                    loadFactor: rec.seats ? (rec.passengers / rec.seats) * 100 : 0
                });
            }
        }
    }
}

// Case A: Multiple routes (Global / TPE only)
console.log('\n--- Case A: Multiple routes (Taiwan Taoyuan Airport only) ---');
const tpeData = flat.filter(r => r.airport === '桃園國際機場');
const tpeInsights = calculateInsightsData(tpeData, flat);

const hasMarketShareInsight = tpeInsights.textInsights.some(ins => ins.icon === '📍');
const hasPeakOffPeakInsight = tpeInsights.textInsights.some(ins => ins.icon === '⏳');
const yoyInsight = tpeInsights.textInsights.find(ins => ins.icon === '📊');

console.log(`Unique Routes count in TPE: ${tpeInsights.topRoutes.length}`);
console.log(`Has Market Share Insight (📍): ${hasMarketShareInsight} (Expected: true)`);
console.log(`Has Peak/Off-peak Season Insight (⏳): ${hasPeakOffPeakInsight} (Expected: false)`);
if (yoyInsight) {
    console.log(`YoY Insight text: "${yoyInsight.text}"`);
} else {
    console.log('YoY Insight (📊) not found');
}

// Case B: Single Route (TPE -> Prague)
console.log('\n--- Case B: Single Route (TPE -> Prague) ---');
const pragueData = flat.filter(r => r.airport === '桃園國際機場' && r.destination === '布拉格');
const pragueInsights = calculateInsightsData(pragueData, flat);

const hasMarketShareInsightB = pragueInsights.textInsights.some(ins => ins.icon === '📍');
const hasPeakOffPeakInsightB = pragueInsights.textInsights.some(ins => ins.icon === '⏳');
const peakOffPeakInsightText = pragueInsights.textInsights.find(ins => ins.icon === '⏳')?.text;

console.log(`Unique Routes count: ${Object.keys(pragueData.reduce((acc, r) => ({...acc, [r.destination]: true}), {})).length}`);
console.log(`Has Market Share Insight (📍): ${hasMarketShareInsightB} (Expected: false)`);
console.log(`Has Peak/Off-peak Season Insight (⏳): ${hasPeakOffPeakInsightB} (Expected: true)`);
if (hasPeakOffPeakInsightB) {
    console.log(`Peak/Off-peak Season text: "${peakOffPeakInsightText}"`);
}

// Assertions
let failed = false;
if (!hasMarketShareInsight) {
    console.error('FAIL: Market share insight missing for multiple routes.');
    failed = true;
}
if (hasPeakOffPeakInsight) {
    console.error('FAIL: Peak/off-peak season insight shown for multiple routes.');
    failed = true;
}
if (hasMarketShareInsightB) {
    console.error('FAIL: Market share insight shown for single route.');
    failed = true;
}
if (!hasPeakOffPeakInsightB) {
    console.error('FAIL: Peak/off-peak season insight missing for single route.');
    failed = true;
}
if (yoyInsight && yoyInsight.text.includes('2026 年度') && yoyInsight.text.includes('2025 年度')) {
    console.error('FAIL: YoY growth still comparing full year with incomplete 2026 year.');
    failed = true;
}

if (failed) {
    console.error('\nTests failed.');
    process.exit(1);
} else {
    console.log('\nAll tests passed successfully!');
}
