const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dataPath = path.join(__dirname, '../data/flight_data_new.js');
let code = fs.readFileSync(dataPath, 'utf8');

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

// Analyze all routes
// We want to find routes that have flights in 2026-04, but had 0 flights in 2024-01 to 2026-03.
const routeHistory = {};

for (const category in flightData) {
    const originAirports = flightData[category];
    for (const origin in originAirports) {
        const dests = originAirports[origin];
        for (const dest in dests) {
            const airlines = dests[dest];
            for (const airline in airlines) {
                const records = airlines[airline];
                records.forEach(r => {
                    const key = `${origin}-${dest}`;
                    if (!routeHistory[key]) {
                        routeHistory[key] = {
                            origin,
                            dest,
                            destinationCountry: DESTINATION_MAP[dest] ? DESTINATION_MAP[dest].country : '未知',
                            history: {}, // year-month -> { flights, seats, passengers }
                            airlineStats: {} // airline -> year-month -> stats
                        };
                    }
                    
                    const ym = `${r.year}-${String(r.month).padStart(2, '0')}`;
                    if (!routeHistory[key].history[ym]) {
                        routeHistory[key].history[ym] = { flights: 0, seats: 0, passengers: 0 };
                    }
                    routeHistory[key].history[ym].flights += r.flights;
                    routeHistory[key].history[ym].seats += r.seats;
                    routeHistory[key].history[ym].passengers += r.passengers;

                    if (!routeHistory[key].airlineStats[airline]) {
                        routeHistory[key].airlineStats[airline] = {};
                    }
                    if (!routeHistory[key].airlineStats[airline][ym]) {
                        routeHistory[key].airlineStats[airline][ym] = { flights: 0, seats: 0, passengers: 0 };
                    }
                    routeHistory[key].airlineStats[airline][ym].flights += r.flights;
                    routeHistory[key].airlineStats[airline][ym].seats += r.seats;
                    routeHistory[key].airlineStats[airline][ym].passengers += r.passengers;
                });
            }
        }
    }
}

console.log("Analyzing 2026-04 flights...");

const newRoutes = [];
const activeIn202604 = [];

for (const key in routeHistory) {
    const route = routeHistory[key];
    const has202604 = route.history['2026-04'] && route.history['2026-04'].seats > 0;
    
    if (has202604) {
        activeIn202604.push(route);
        
        // Check if there was any flight BEFORE 2026-04
        let hadPreviousFlights = false;
        for (const ym in route.history) {
            if (ym === '2026-04') continue;
            // check if there were flights
            if (route.history[ym].seats > 0) {
                hadPreviousFlights = true;
                break;
            }
        }
        
        if (!hadPreviousFlights) {
            newRoutes.push(route);
        }
    }
}

console.log(`\n================================================================`);
console.log(`【定義 A】2026年4月全新開航的航線 (2024-01 至 2026-03 均無航班)`);
console.log(`================================================================`);
if (newRoutes.length === 0) {
    console.log("沒有符合嚴格全新開航定義的航線。");
} else {
    newRoutes.forEach(r => {
        const stats = r.history['2026-04'];
        const lf = (stats.passengers / stats.seats) * 100;
        const airlines = Object.keys(r.airlineStats).filter(a => r.airlineStats[a]['2026-04'] && r.airlineStats[a]['2026-04'].seats > 0);
        console.log(`航線: ${r.origin} ➔ ${r.dest} (${r.destinationCountry})`);
        console.log(`  航空公司: ${airlines.join(', ')}`);
        console.log(`  2026-04 航班數: ${stats.flights} 班 | 座位數: ${stats.seats} | 旅客數: ${stats.passengers} | 載客率: ${lf.toFixed(2)}%`);
    });
}

// Let's also check if there are routes that started very recently (e.g. in 2026-03 or 2026-04)
// Or routes that had no flights in 2025, but resumed in 2026-04
console.log(`\n================================================================`);
console.log(`【定義 B】2026年近期新增或復航的航線 (2025年整年無航班，但在2026年4月有航班)`);
console.log(`================================================================`);
const resumedRoutes = [];
for (const key in routeHistory) {
    const route = routeHistory[key];
    const has202604 = route.history['2026-04'] && route.history['2026-04'].seats > 0;
    if (has202604) {
        // Check if active in 2025
        let activeIn2025 = false;
        for (let m = 1; m <= 12; m++) {
            const ym = `2025-${String(m).padStart(2, '0')}`;
            if (route.history[ym] && route.history[ym].seats > 0) {
                activeIn2025 = true;
                break;
            }
        }
        
        // Also check if active in 2024 to make sure it's not a brand new route (which is already in newRoutes)
        let activeIn2024Or2026Early = false;
        for (const ym in route.history) {
            if (ym.startsWith('2025') || ym === '2026-04') continue;
            if (route.history[ym].seats > 0) {
                activeIn2024Or2026Early = true;
                break;
            }
        }
        
        if (!activeIn2025 && activeIn2024Or2026Early) {
            resumedRoutes.push(route);
        }
    }
}

if (resumedRoutes.length === 0) {
    console.log("沒有符合 2025年無航班但在 2026年4月復航的航線。");
} else {
    resumedRoutes.forEach(r => {
        const stats = r.history['2026-04'];
        const lf = (stats.passengers / stats.seats) * 100;
        const airlines = Object.keys(r.airlineStats).filter(a => r.airlineStats[a]['2026-04'] && r.airlineStats[a]['2026-04'].seats > 0);
        console.log(`航線: ${r.origin} ➔ ${r.dest} (${r.destinationCountry})`);
        console.log(`  航空公司: ${airlines.join(', ')}`);
        console.log(`  2026-04 航班數: ${stats.flights} 班 | 座位數: ${stats.seats} | 旅客數: ${stats.passengers} | 載客率: ${lf.toFixed(2)}%`);
    });
}

// Let's also output all routes that had flights in 2026-04 but had 0 flights in 2026-01 to 2026-03 (Started in April 2026)
console.log(`\n================================================================`);
console.log(`【定義 C】在 2026 年 4 月才首度出現的航線 (2026-01 至 2026-03 均無航班，不限 2024-2025)`);
console.log(`================================================================`);
const startedInApril = [];
for (const key in routeHistory) {
    const route = routeHistory[key];
    const has202604 = route.history['2026-04'] && route.history['2026-04'].seats > 0;
    if (has202604) {
        let activeIn2026Early = false;
        for (let m = 1; m <= 3; m++) {
            const ym = `2026-${String(m).padStart(2, '0')}`;
            if (route.history[ym] && route.history[ym].seats > 0) {
                activeIn2026Early = true;
                break;
            }
        }
        if (!activeIn2026Early) {
            startedInApril.push(route);
        }
    }
}

if (startedInApril.length === 0) {
    console.log("沒有符合 2026年4月才首度出現的航線。");
} else {
    startedInApril.forEach(r => {
        const stats = r.history['2026-04'];
        const lf = (stats.passengers / stats.seats) * 100;
        const airlines = Object.keys(r.airlineStats).filter(a => r.airlineStats[a]['2026-04'] && r.airlineStats[a]['2026-04'].seats > 0);
        console.log(`航線: ${r.origin} ➔ ${r.dest} (${r.destinationCountry})`);
        console.log(`  航空公司: ${airlines.join(', ')}`);
        console.log(`  2026-04 航班數: ${stats.flights} 班 | 座位數: ${stats.seats} | 旅客數: ${stats.passengers} | 載客率: ${lf.toFixed(2)}%`);
    });
}
