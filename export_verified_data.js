const fs = require('fs');
const vm = require('vm');

let code = fs.readFileSync('./data/flight_data_new.js', 'utf8');
code = code.replace('const flightData =', 'flightData =');
const sandbox = { flightData: null };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const fd = sandbox.flightData;

const japanDests = ["東京成田", "大阪", "沖繩", "東京羽田", "福岡", "札幌", "名古屋", "仙台", "熊本", "神戶", "高松", "岡山", "小松", "函館", "廣島", "松山", "青森", "鹿兒島", "佐賀", "高知", "花卷", "秋田", "大分", "旭川", "福島", "新潟", "米子", "宮崎", "茨城", "富山"];

const stats = {};

for (const cat in fd) {
    for (const origin in fd[cat]) {
        for (const dest in fd[cat][origin]) {
            if (!japanDests.includes(dest)) continue;

            const key = `${origin}|${dest}`;
            if (!stats[key]) {
                stats[key] = { origin, dest, nov25: { p: 0, s: 0 }, nov24: { p: 0, s: 0 } };
            }

            for (const airline in fd[cat][origin][dest]) {
                fd[cat][origin][dest][airline].forEach(r => {
                    if (r.year === 2025 && r.month === 11) {
                        stats[key].nov25.p += r.passengers;
                        stats[key].nov25.s += r.seats;
                    }
                    if (r.year === 2024 && r.month === 11) {
                        stats[key].nov24.p += r.passengers;
                        stats[key].nov24.s += r.seats;
                    }
                });
            }
        }
    }
}

const results = Object.values(stats)
    .map(d => {
        const lf25 = d.nov25.s > 0 ? (d.nov25.p / d.nov25.s * 100) : 0;
        const lf24 = d.nov24.s > 0 ? (d.nov24.p / d.nov24.s * 100) : 0;
        const volYoY = d.nov24.p > 0 ? ((d.nov25.p - d.nov24.p) / d.nov24.p * 100) : null;
        return {
            origin: d.origin.replace('國際機場', '').replace('機場', ''),
            dest: d.dest,
            lf25: lf25.toFixed(1),
            lf24: lf24.toFixed(1),
            lfYoY: (lf25 - lf24).toFixed(1),
            pax25: d.nov25.p,
            pax24: d.nov24.p,
            volYoY: volYoY !== null ? volYoY.toFixed(1) : 'New'
        };
    })
    .filter(r => r.pax25 > 0)
    .sort((a, b) => b.pax25 - a.pax25);

// Top routes table
console.log("## TOP ROUTES BY PASSENGER VOLUME");
console.log("| 航線 | 載客率 | 載客率YoY | 載客人次 | 人次YoY |");
console.log("|:---|:---:|:---:|:---:|:---:|");
results.slice(0, 15).forEach(r => {
    const lfSign = parseFloat(r.lfYoY) >= 0 ? '+' : '';
    const volSign = r.volYoY !== 'New' && parseFloat(r.volYoY) >= 0 ? '+' : '';
    console.log(`| ${r.origin}-${r.dest} | ${r.lf25}% | ${lfSign}${r.lfYoY}% | ${r.pax25.toLocaleString()} | ${r.volYoY === 'New' ? 'New' : volSign + r.volYoY + '%'} |`);
});

console.log("\n## BY ORIGIN AIRPORT");
const byOrigin = {};
results.forEach(r => {
    if (!byOrigin[r.origin]) byOrigin[r.origin] = [];
    byOrigin[r.origin].push(r);
});

for (const origin in byOrigin) {
    const routes = byOrigin[origin].sort((a, b) => parseFloat(b.lf25) - parseFloat(a.lf25));
    console.log(`\n### ${origin}`);
    console.log("| 目的地 | 載客率 | 載客率YoY | 載客人次 | 人次YoY |");
    console.log("|:---|:---:|:---:|:---:|:---:|");
    routes.forEach(r => {
        const lfSign = parseFloat(r.lfYoY) >= 0 ? '+' : '';
        const volSign = r.volYoY !== 'New' && parseFloat(r.volYoY) >= 0 ? '+' : '';
        console.log(`| ${r.dest} | ${r.lf25}% | ${lfSign}${r.lfYoY}% | ${r.pax25.toLocaleString()} | ${r.volYoY === 'New' ? 'New' : volSign + r.volYoY + '%'} |`);
    });
}
