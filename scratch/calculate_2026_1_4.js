const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/flight_data_all.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const flights = JSON.parse(rawData);

console.log('Total flights in dataset:', flights.length);

// 檢查有哪些 2026 年的航空公司名稱
const airlines2026 = new Set();
flights.forEach(f => {
  if (f.year === 2026 || f.year === '2026') {
    airlines2026.add(f.airline);
  }
});
console.log('Airlines in 2026:', Array.from(airlines2026));

// 四大航司累計數據 (2026-01 至 2026-04)
const targetAirlines = ['長榮航空', '中華航空', '星宇航空', '台灣虎航'];

const stats = {};
targetAirlines.forEach(a => {
  stats[a] = {
    flights: 0,
    totalSeats: 0,
    passengers: 0
  };
});

flights.forEach(f => {
  const year = parseInt(f.year);
  const month = parseInt(f.month);
  
  if (year === 2026 && month >= 1 && month <= 4) {
    // 匹配航空公司
    let matchedAirline = null;
    if (f.airline.includes('長榮')) matchedAirline = '長榮航空';
    else if (f.airline.includes('中華') || f.airline.includes('華航')) matchedAirline = '中華航空';
    else if (f.airline.includes('星宇')) matchedAirline = '星宇航空';
    else if (f.airline.includes('虎航') || f.airline.includes('Tigerair')) matchedAirline = '台灣虎航';

    if (matchedAirline) {
      stats[matchedAirline].flights += parseInt(f.flights || 0);
      stats[matchedAirline].totalSeats += parseInt(f.totalSeats || f.seats || 0);
      stats[matchedAirline].passengers += parseInt(f.passengers || 0);
    }
  }
});

console.log('\n--- 2026-01 ~ 2026-04 累計數據 ---');
let totalFourAirlinesPassengers = 0;
Object.keys(stats).forEach(a => {
  totalFourAirlinesPassengers += stats[a].passengers;
});

Object.keys(stats).forEach(a => {
  const s = stats[a];
  const loadFactor = s.totalSeats > 0 ? (s.passengers / s.totalSeats) * 100 : 0;
  const share = totalFourAirlinesPassengers > 0 ? (s.passengers / totalFourAirlinesPassengers) * 100 : 0;
  console.log(`${a}:`);
  console.log(`  航班數: ${s.flights.toLocaleString()}`);
  console.log(`  可供座位數: ${s.totalSeats.toLocaleString()}`);
  console.log(`  實際旅客數: ${s.passengers.toLocaleString()}`);
  console.log(`  載客率: ${loadFactor.toFixed(2)}%`);
  console.log(`  四大航市佔率: ${share.toFixed(2)}%`);
});
