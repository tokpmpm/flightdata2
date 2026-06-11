const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/flight_data_all.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const flights = JSON.parse(rawData);

const airlineStats = {};

flights.forEach(f => {
  const year = parseInt(f.year);
  const month = parseInt(f.month);
  
  if (year === 2026 && month >= 1 && month <= 4) {
    const airlineName = f.airline;
    if (!airlineStats[airlineName]) {
      airlineStats[airlineName] = {
        flights: 0,
        totalSeats: 0,
        passengers: 0
      };
    }
    airlineStats[airlineName].flights += parseInt(f.flights || 0);
    airlineStats[airlineName].totalSeats += parseInt(f.totalSeats || f.seats || 0);
    airlineStats[airlineName].passengers += parseInt(f.passengers || 0);
  }
});

// 計算載客率並排序
const result = [];
Object.keys(airlineStats).forEach(name => {
  const stats = airlineStats[name];
  const loadFactor = stats.totalSeats > 0 ? (stats.passengers / stats.totalSeats) * 100 : 0;
  result.push({
    name,
    flights: stats.flights,
    totalSeats: stats.totalSeats,
    passengers: stats.passengers,
    loadFactor
  });
});

// 1. 不限航班數排序
const sortedAll = [...result].sort((a, b) => b.loadFactor - a.loadFactor);
console.log('--- 2026-01 ~ 2026-04 所有航司載客率 Top 10 (不限航班數) ---');
sortedAll.slice(0, 10).forEach((item, index) => {
  console.log(`${index + 1}. ${item.name}: ${item.loadFactor.toFixed(2)}% (航班: ${item.flights}, 旅客: ${item.passengers.toLocaleString()})`);
});

// 2. 限制航班數 >= 100 班 (定期主要航司) 排序
const sortedRegular = result
  .filter(item => item.flights >= 100)
  .sort((a, b) => b.loadFactor - a.loadFactor);

console.log('\n--- 2026-01 ~ 2026-04 主要定期航司載客率 Top 10 (航班 >= 100) ---');
sortedRegular.slice(0, 10).forEach((item, index) => {
  console.log(`${index + 1}. ${item.name}: ${item.loadFactor.toFixed(2)}% (航班: ${item.flights}, 旅客: ${item.passengers.toLocaleString()})`);
});
