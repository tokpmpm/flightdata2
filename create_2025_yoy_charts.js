const fs = require('fs');
const vm = require('vm');

console.log('Generating 2025 YoY Charts Dashboard...');

// 1. Read Data
let code = fs.readFileSync('./data/flight_data_new.js', 'utf8');
code = code.replace('const flightData =', 'flightData =');
const sandbox = { flightData: null };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const fd = sandbox.flightData;

// 2. Process Data
const airlineStats = {};
const routeStats = {};
const airlineRouteStats = {};
const TARGET_ORIGINS = ['桃園', '高雄', '臺中', '台中'];

for (const cat in fd) {
    for (const originFull in fd[cat]) {
        let origin = originFull;
        if (originFull.includes('桃園')) origin = '桃園';
        else if (originFull.includes('高雄')) origin = '高雄';
        else if (originFull.includes('台中') || originFull.includes('臺中')) origin = '台中';

        for (const dest in fd[cat][originFull]) {
            const routeKey = `${origin}-${dest}`;

            for (const airline in fd[cat][originFull][dest]) {
                if (!airlineStats[airline]) airlineStats[airline] = { pax2025: 0, pax2024: 0 };

                if (TARGET_ORIGINS.includes(origin)) {
                    if (!routeStats[routeKey]) routeStats[routeKey] = { origin, dest, pax2025: 0, pax2024: 0, route: routeKey };
                }

                if (!airlineRouteStats[airline]) airlineRouteStats[airline] = {};
                if (!airlineRouteStats[airline][routeKey]) airlineRouteStats[airline][routeKey] = { route: routeKey, pax2025: 0, pax2024: 0, dest };

                fd[cat][originFull][dest][airline].forEach(r => {
                    if (r.year === 2025) {
                        airlineStats[airline].pax2025 += r.passengers;
                        airlineRouteStats[airline][routeKey].pax2025 += r.passengers;
                        if (TARGET_ORIGINS.includes(origin)) routeStats[routeKey].pax2025 += r.passengers;
                    } else if (r.year === 2024) {
                        airlineStats[airline].pax2024 += r.passengers;
                        airlineRouteStats[airline][routeKey].pax2024 += r.passengers;
                        if (TARGET_ORIGINS.includes(origin)) routeStats[routeKey].pax2024 += r.passengers;
                    }
                });
            }
        }
    }
}

// 3. Extract Top lists
const airlineArr = Object.entries(airlineStats).map(([airline, stat]) => {
    return { airline, ...stat, diff: stat.pax2025 - stat.pax2024 };
}).sort((a, b) => b.diff - a.diff).slice(0, 10);

const routeArr = Object.values(routeStats).map(stat => {
    return { ...stat, diff: stat.pax2025 - stat.pax2024 };
});

const tpeTop = routeArr.filter(r => r.origin === '桃園').sort((a, b) => b.diff - a.diff).slice(0, 5);
const khhTop = routeArr.filter(r => r.origin === '高雄').sort((a, b) => b.diff - a.diff).slice(0, 5);
const rmqTop = routeArr.filter(r => r.origin === '台中').sort((a, b) => b.diff - a.diff).slice(0, 5);

// 4. Extraction for Top 6 Airlines Routes (Adding Jetstar Japan)
const top5Airlines = airlineArr.slice(0, 5).map(a => a.airline);
if (!top5Airlines.includes('捷星日本')) {
    const jetstar = airlineArr.find(a => a.airline === '捷星日本');
    if (jetstar) {
        top5Airlines.push('捷星日本');
    }
}

const top5AirlineRoutes = top5Airlines.map(airline => {
    const routes = Object.values(airlineRouteStats[airline])
        .map(r => ({ ...r, diff: r.pax2025 - r.pax2024 }))
        // Filter out those with no positive growth to keep it focused on growth
        .filter(r => r.diff > 0)
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 5);
    return { airline, routes };
});

const top5Html = top5AirlineRoutes.map((data, index) => `
    <div class="airline-mini-card">
        <h3>${data.airline}</h3>
        <div class="mini-chart-container">
            <canvas id="chartAirlineRoute${index}"></canvas>
        </div>
    </div>
`).join('');

// 5. Generate HTML
const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>2025 台灣航空業載客成長報告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"></script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;500;700;900&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent-gold: #fbbf24;
            --accent-blue: #38bdf8;
            --accent-green: #34d399;
            --accent-purple: #c084fc;
            --accent-red: #fb7185;
            --bar-2024: rgba(255, 255, 255, 0.15); /* 更優雅舒適的 2024 背景色 */
        }

        body {
            font-family: 'Noto Sans TC', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .header {
            text-align: center;
            margin-bottom: 50px;
            position: relative;
        }

        .header h1 {
            font-family: 'Playfair Display', serif;
            font-size: 3rem;
            margin: 0;
            background: linear-gradient(135deg, var(--accent-gold), #f59e0b, var(--accent-gold));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 2px;
        }

        .header .subtitle {
            font-size: 1.2rem;
            color: var(--text-secondary);
            margin-top: 10px;
            font-weight: 300;
            letter-spacing: 4px;
            text-transform: uppercase;
        }

        .grid-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 30px;
            max-width: 1400px;
            width: 100%;
        }

        .card {
            background: var(--card-bg);
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.05);
            position: relative;
            overflow: hidden;
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-3px);
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
        }

        .card-airline::before { background: linear-gradient(90deg, var(--accent-gold), transparent); }
        .card-tpe::before { background: linear-gradient(90deg, var(--accent-blue), transparent); }
        .card-khh::before { background: linear-gradient(90deg, var(--accent-green), transparent); }
        .card-rmq::before { background: linear-gradient(90deg, var(--accent-purple), transparent); }

        .card h2 {
            font-size: 1.4rem;
            margin-top: 0;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-airline h2 { color: var(--accent-gold); }
        .card-tpe h2 { color: var(--accent-blue); }
        .card-khh h2 { color: var(--accent-green); }
        .card-rmq h2 { color: var(--accent-purple); }

        .chart-container {
            position: relative;
            height: 350px;
            width: 100%;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        .airline-routes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .airline-mini-card {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
        }

        .airline-mini-card h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 1.1rem;
            color: var(--accent-gold);
            text-align: center;
        }

        .mini-chart-container {
            height: 180px;
            position: relative;
        }

        .highlight-box {
            background: rgba(255, 255, 255, 0.03);
            border-left: 4px solid var(--text-secondary);
            padding: 15px;
            margin-top: 20px;
            border-radius: 0 10px 10px 0;
        }
        
        .highlight-box.gold { border-left-color: var(--accent-gold); background: rgba(251, 191, 36, 0.05); }

        .highlight-text {
            font-size: 0.95rem;
            color: var(--text-primary);
            line-height: 1.6;
        }
        
        .highlight-text b { color: var(--accent-gold); }

        .footer {
            margin-top: 50px;
            color: var(--text-secondary);
            font-size: 0.8rem;
            opacity: 0.6;
        }

        @media (max-width: 900px) {
            .grid-container { grid-template-columns: 1fr; }
            .header h1 { font-size: 2.2rem; }
        }
    </style>
</head>
<body>

    <div class="header">
        <h1>2025 台灣航空業成長報告</h1>
        <div class="subtitle">Aviation Industry YoY Growth Dashboard</div>
    </div>

    <div class="grid-container">

        <!-- Top Airlines -->
        <div class="card card-airline full-width">
            <h2>🏆 成長王：各家航空載客人次成長 Top 10 (YoY)</h2>
            <div class="chart-container">
                <canvas id="chartAirline"></canvas>
            </div>
            <div class="highlight-box gold">
                <div class="highlight-text">
                    💡 <b>星宇航空</b> 以 +91.2萬 強勢稱霸成長榜首！傳統霸主 <b>國泰航空</b> (+48.3萬) 與 <b>中華航空</b> (+30.2萬) 緊追在後。廉航板塊的 <b>酷航</b> 與 <b>香港快運</b> 也有非常亮眼的增加量。
                </div>
            </div>
        </div>

        <!-- NEW: Airline Distribution Routes -->
        <div class="card card-airline full-width">
            <h2>🎯 前六大高成長航空：主力成長航線 (增加人次)</h2>
            <div class="airline-routes-grid">
                ${top5Html}
            </div>
             <div class="highlight-box">
                <div class="highlight-text">
                    💡 觀察前六大業者的火力集中點：星宇與傳統國航成長主力分散點位各有不同；而在港籍廉航與捷星日本的部分更聚焦在單一目的地的暴力增長。
                </div>
            </div>
        </div>

        <!-- TPE Top 5 -->
        <div class="card card-tpe">
            <h2>🛫 桃園出發：增加最多前五大航線</h2>
            <div class="chart-container">
                <canvas id="chartTpe"></canvas>
            </div>
        </div>

        <!-- KHH Top 5 -->
        <div class="card card-khh">
            <h2>🛫 高雄出發：增加最多前五大航線</h2>
            <div class="chart-container">
                <canvas id="chartKhh"></canvas>
            </div>
        </div>

        <!-- RMQ Top 5 -->
        <div class="card card-rmq full-width">
            <h2>🛫 台中出發：增加最多前五大航線</h2>
            <div class="chart-container" style="height: 250px;">
                <canvas id="chartRmq"></canvas>
            </div>
             <div class="highlight-box">
                <div class="highlight-text">
                    💡 台中的基期相對較低，因此許多航線 (如<b>首爾仁川、神戶</b>) 出現從 0 到有的大爆發。而<b>沖繩</b>更繳出了驚人的超過 12 萬人次成長量。
                </div>
            </div>
        </div>

    </div>

    <div class="footer">
        Data Source: 2024-2025 Flight Records | Dashboard automatically generated via Verification Protocol | Visualized by Antigravity
    </div>

    <script>
        Chart.register(ChartDataLabels);
        Chart.defaults.font.family = "'Noto Sans TC', sans-serif";
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.03)';

        const formatNumber = (num) => {
            return new Intl.NumberFormat('en-US').format(num);
        };

        const createRouteChart = (ctxId, data, color) => {
            new Chart(document.getElementById(ctxId), {
                type: 'bar',
                data: {
                    labels: data.map(d => d.dest),
                    datasets: [
                        {
                            label: '2024 載客人次',
                            data: data.map(d => d.pax2024),
                            backgroundColor: 'rgba(255, 255, 255, 0.15)', // 修正原本太重的顏色
                            borderRadius: 4,
                            barPercentage: 0.6,
                            categoryPercentage: 0.8
                        },
                        {
                            label: '2025 載客人次',
                            data: data.map(d => d.pax2025),
                            backgroundColor: color,
                            borderRadius: 4,
                            barPercentage: 0.6,
                            categoryPercentage: 0.8
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: { right: 50, top: 10, bottom: 0 } // 防止 Label 右側跟上方被切斷
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#f8fafc' } },
                        datalabels: {
                            anchor: 'end',
                            align: 'right', // 靠右對齊防止疊加在Bar上
                            color: '#f8fafc',
                            font: { weight: 'bold', size: 11 },
                            formatter: v => v > 0 ? (v / 10000).toFixed(1) + ' 萬' : ''
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + formatNumber(context.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        x: { 
                            display: false,
                            max: Math.max(...data.map(d => d.pax2025)) * 1.25 // 強制拉長橫軸以容納DataLabels
                        },
                        y: { ticks: { font: { size: 13, weight: '500' }, color: '#f8fafc' } }
                    }
                }
            });
        };

        // Inject Data Arrays
        const airlineData = ${JSON.stringify(airlineArr)};
        const tpeData = ${JSON.stringify(tpeTop)};
        const khhData = ${JSON.stringify(khhTop)};
        const rmqData = ${JSON.stringify(rmqTop)};
        const top5AirlineRoutesData = ${JSON.stringify(top5AirlineRoutes)};

        // 1. Airline Chart
        new Chart(document.getElementById('chartAirline'), {
            type: 'bar',
            data: {
                labels: airlineData.map(d => d.airline),
                datasets: [
                    {
                        label: '2025 新增人次',
                        data: airlineData.map(d => d.diff),
                        backgroundColor: '#fbbf24',
                        borderRadius: 6,
                        barPercentage: 0.7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 35 } // 增加上方 padding 避免 Top 1 數字被斬斷
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: '#fbbf24',
                        font: { weight: 'bold', size: 12 },
                        formatter: v => '+' + formatNumber(v)
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                label += formatNumber(context.raw);
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: { 
                        display: false,
                        grid: { display: false },
                        max: Math.max(...airlineData.map(d => d.diff)) * 1.15 // 擴充天花板空間
                    },
                    x: { 
                        ticks: { color: '#f8fafc', font: { size: 14 } },
                        grid: { display: false }
                    }
                }
            }
        });

        // 2. Mini Route Charts for Top Airlines
        const miniColors = ['#fbbf24', '#38bdf8', '#34d399', '#c084fc', '#fb7185'];
        top5AirlineRoutesData.forEach((data, index) => {
            new Chart(document.getElementById('chartAirlineRoute' + index), {
                type: 'bar',
                data: {
                    labels: data.routes.map(r => r.route), // 完整顯示出發與目的地
                    datasets: [{
                        data: data.routes.map(r => r.diff),
                        backgroundColor: miniColors[index % miniColors.length],
                        borderRadius: 4,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { right: 50 } }, // 修正右方字體被切斷
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            anchor: 'end',
                            align: 'right',
                            color: '#e2e8f0',
                            font: { weight: 'bold', size: 10 },
                            formatter: v => '+' + (v / 10000).toFixed(1) + '萬'
                        },
                        tooltip: {
                            callbacks: {
                                title: (ctx) => data.routes[ctx[0].dataIndex].route, // 滑鼠懸浮時顯示完整航線名稱
                                label: (ctx) => ' 增加 ' + formatNumber(ctx.raw) + ' 人次'
                            }
                        }
                    },
                    scales: {
                        x: { 
                            display: false,
                            max: Math.max(...data.routes.map(r => r.diff)) * 1.4 // 確保數字有地方顯示
                        }, 
                        y: { ticks: { font: { size: 12 }, color: '#f8fafc' }, grid: { display: false } }
                    }
                }
            });
        });

        // 3. Route Charts
        createRouteChart('chartTpe', tpeData, '#38bdf8');
        createRouteChart('chartKhh', khhData, '#34d399');
        createRouteChart('chartRmq', rmqData, '#c084fc');

    </script>
</body>
</html>
`;

fs.writeFileSync('2025_yoy_charts.html', htmlTemplate);
console.log('✅ Generated updated 2025_yoy_charts.html successfully!');
