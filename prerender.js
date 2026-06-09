/**
 * Static Site Generation (SSG) Pre-rendering Script
 * Reads raw flight data and generates SEO/AIEO-optimized static HTML pages.
 * Output: index.html (home), airport/{code}/index.html (6 airports), sitemap.xml, robots.txt, and CSV/JSON datasets.
 */

const fs = require('fs');
const path = require('path');
const { calculateInsightsData, generateStaticInsightsHTML } = require('./js/insights.js');

const SITE_URL = 'https://flightdata2.meshthings.com';

const airportCodes = {
    '桃園國際機場': 'tpe',
    '高雄國際機場': 'khh',
    '松山機場': 'tsa',
    '臺中機場': 'rmq',
    '臺南機場': 'tnn',
    '花蓮機場': 'hun'
};

// Start Years and Months configurations
const DEFAULT_START_YEAR = 2024;
const DEFAULT_START_MONTH = 1;

/**
 * Helper to aggregate load factor colors
 */
function getLoadFactorColor(loadFactor) {
    const value = parseFloat(loadFactor);
    if (value >= 85) return 'linear-gradient(135deg, #16a34a, #15803d)';
    if (value >= 70) return 'linear-gradient(135deg, #2563eb, #1d4ed8)';
    if (value >= 50) return 'linear-gradient(135deg, #ca8a04, #a16207)';
    return 'linear-gradient(135deg, #dc2626, #b91c1c)';
}

/**
 * Render the static HTML table rows for SSG
 */
function renderStaticTable(filteredData) {
    const aggregatedData = new Map();
    filteredData.forEach(record => {
        const key = `${record.yearMonth}-${record.airline}`;

        if (!aggregatedData.has(key)) {
            aggregatedData.set(key, {
                yearMonth: record.yearMonth,
                airline: record.airline,
                flights: 0,
                totalSeats: 0,
                passengers: 0
            });
        }

        const agg = aggregatedData.get(key);
        agg.flights += record.flights;
        agg.totalSeats += record.totalSeats;
        agg.passengers += record.passengers;
    });

    const rows = Array.from(aggregatedData.values()).sort((a, b) => {
        if (a.yearMonth === b.yearMonth) {
            return a.airline.localeCompare(b.airline);
        }
        return b.yearMonth.localeCompare(a.yearMonth);
    });

    if (rows.length === 0) {
        return '<tr><td colspan="6" class="loading-cell">沒有符合條件的數據</td></tr>';
    }

    return rows.map(row => {
        const loadFactor = row.totalSeats > 0
            ? (row.passengers / row.totalSeats * 100).toFixed(2)
            : '0.00';
        const lfColor = getLoadFactorColor(loadFactor);

        return `
            <tr data-label="年月">
                <td data-label="年月">${row.yearMonth}</td>
                <td data-label="航空公司">${row.airline}</td>
                <td data-label="航班數">${row.flights.toLocaleString()}</td>
                <td data-label="總座位數">${row.totalSeats.toLocaleString()}</td>
                <td data-label="載客人數">${row.passengers.toLocaleString()}</td>
                <td data-label="載客率">
                    <span class="load-factor-badge" style="background: ${lfColor}">
                        ${loadFactor}%
                    </span>
                </td>
            </tr>
        `;
    }).join('\n');
}

/**
 * Main build pipeline
 */
function build() {
    console.log('Starting static site build pipeline...');

    // 1. Load raw flight data
    console.log('Loading flight data via require...');
    let flightDataObj;
    try {
        const dataModule = require('./data/flight_data_new.js');
        flightDataObj = dataModule.flightData;
        if (!flightDataObj) {
            throw new Error('flightData object is undefined in the module');
        }
    } catch (e) {
        console.error('Failed to load flight data file:', e);
        process.exit(1);
    }

    // Flatten raw data into records
    const allRecords = [];
    const all = flightDataObj["所有"] || {};

    for (const airportName in all) {
        const destinations = all[airportName];
        for (const destination in destinations) {
            const airlines = destinations[destination];
            for (const airlineName in airlines) {
                const records = airlines[airlineName];
                if (!Array.isArray(records)) continue;
                for (const rec of records) {
                    allRecords.push({
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
    console.log(`Successfully loaded and flattened ${allRecords.length} records.`);

    // Read template HTML
    const templatePath = path.join(__dirname, 'template.html');
    if (!fs.existsSync(templatePath)) {
        console.error('Error: template.html does not exist. Please duplicate index.html to template.html first.');
        process.exit(1);
    }
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    // Find date range boundaries
    const sortedRecords = [...allRecords].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    const latestRecord = sortedRecords[0];
    const latestYear = latestRecord.year;
    const latestMonth = latestRecord.month;
    const latestYearMonthStr = `${latestYear}年${latestMonth}月`;

    console.log(`Global date range for pre-rendering: 2024-01 to ${latestRecord.yearMonth}`);

    // Define function to generate page
    function generatePage(targetAirport, outputFilePath, relativeUrlPath) {
        let filteredRecords = allRecords;
        
        // Filter by date range (2024-01 to latest)
        const startVal = DEFAULT_START_YEAR * 100 + DEFAULT_START_MONTH;
        const endVal = latestYear * 100 + latestMonth;
        
        filteredRecords = filteredRecords.filter(r => {
            const currentVal = r.year * 100 + r.month;
            return currentVal >= startVal && currentVal <= endVal;
        });

        // Filter by airport if specified
        if (targetAirport) {
            filteredRecords = filteredRecords.filter(r => r.airport === targetAirport);
        }

        // Calculate insights & get static HTML
        const insightsData = calculateInsightsData(filteredRecords, allRecords);
        const staticHtml = generateStaticInsightsHTML(insightsData);
        const tableHtml = renderStaticTable(filteredRecords);

        // Page variables
        let pageTitle = '台灣航空載客率數據分析儀表板 | 互動統計與趨勢';
        let pageDesc = `台灣航空載客率數據分析，提供起降航班數、總座位數、載客人數統計。累計總旅客人次達 ${insightsData.kpis.totalPassengers.toLocaleString()} 人，平均載客率 ${insightsData.kpis.avgLoadFactor.toFixed(1)}%。`;
        let breadcrumbHtml = '';

        if (targetAirport) {
            pageTitle = `${targetAirport}(${airportCodes[targetAirport].toUpperCase()})航空載客率數據分析儀表板`;
            pageDesc = `${targetAirport}載客率與航班數據分析，包含熱門目的地排行榜、座位利用率年度熱力圖與航空公司市佔率。統計期間累計旅客人次達 ${insightsData.kpis.totalPassengers.toLocaleString()} 人。`;
            
            // Add breadcrumb
            breadcrumbHtml = `
            <div class="breadcrumb" style="margin-bottom: var(--space-4); font-size: 0.875rem; color: var(--color-text-secondary);">
                <a href="/" style="color: var(--color-primary); text-decoration: none;">首頁</a> &gt; 
                <span style="color: var(--color-text-primary); font-weight: 500;">${targetAirport}</span>
            </div>`;
        }

        let html = templateHtml;

        // Inject page metadata
        html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
        html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${pageDesc}">`);

        // Inject Canonical URL
        const canonicalUrl = `${SITE_URL}${relativeUrlPath}`;
        const canonicalTag = `<link rel="canonical" href="${canonicalUrl}">`;
        html = html.replace('</head>', `${canonicalTag}\n</head>`);

        // Inject JSON-LD Schema.org Structured Data
        const datasetName = targetAirport 
            ? (targetAirport.endsWith('機場') ? `${targetAirport}航空載客率數據庫` : `${targetAirport}機場航空載客率數據庫`)
            : '全台機場航空載客率數據庫';

        const jsonLd = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": pageTitle,
            "description": pageDesc,
            "url": canonicalUrl,
            "about": {
                "@type": "Dataset",
                "name": datasetName,
                "description": `包含 ${targetAirport || '台灣主要機場'} 起降班次、座位數及載客人數的月度統計數據`,
                "license": "https://creativecommons.org/licenses/by/4.0/",
                "temporalCoverage": `2024-01-01/${latestYear}-${String(latestMonth).padStart(2, '0')}-01`,
                "spatialCoverage": {
                    "@type": "Place",
                    "name": targetAirport || "Taiwan"
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "民航局"
                }
            }
        };
        const jsonLdHtml = `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`;
        html = html.replace('</head>', `${jsonLdHtml}\n</head>`);

        // Inject breadcrumbs if not homepage
        if (breadcrumbHtml) {
            html = html.replace(
                /(<main class="main">[\s\S]*?<div class="container">)/,
                `$1\n${breadcrumbHtml}`
            );
        }

        // Replace KPIs
        html = html.replace(
            /(<div class="kpi-row" id="kpi-summary">)[\s\S]*?(<\/div>\s*<\/div>\s*<\/header>)/,
            `$1\n${staticHtml.kpiHtml}\n</div>\n</div>\n</header>`
        );

        // Replace Smart Insights
        html = html.replace(
            /(<ul class="insights-list" id="insights-list">)[\s\S]*?(<\/ul>)/,
            `$1\n${staticHtml.insightsHtml}\n$2`
        );

        // Replace Top Routes
        html = html.replace(
            /(<div class="top-routes-list" id="top-routes-list">)[\s\S]*?(<\/div>)/,
            `$1\n${staticHtml.routesHtml}\n$2`
        );

        // Replace Heatmap
        html = html.replace(
            /(<div class="heatmap-container" id="heatmap-container">)[\s\S]*?(<\/div>)/,
            `$1\n${staticHtml.heatmapHtml}\n$2`
        );

        // Replace Data Table Body
        html = html.replace(
            /(<tbody id="table-body">)[\s\S]*?(<\/tbody>)/,
            `$1\n${tableHtml}\n$2`
        );

        // Inject hydration tag to notify client
        html = html.replace(
            /<tbody id="table-body">/,
            '<tbody id="table-body" data-prerendered="true">'
        );

        // Save output file
        const dir = path.dirname(outputFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputFilePath, html, 'utf8');
        console.log(`Generated page: ${outputFilePath}`);
    }

    // 2. Generate HomePage
    generatePage(null, path.join(__dirname, 'index.html'), '/');

    // 3. Generate Airport Pages
    for (const airportName in airportCodes) {
        const code = airportCodes[airportName];
        generatePage(
            airportName, 
            path.join(__dirname, 'airport', code, 'index.html'), 
            `/airport/${code}/`
        );
    }

    // 4. Generate sitemap.xml
    console.log('Generating sitemap.xml...');
    const now = new Date().toISOString().split('T')[0];
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
`;
    for (const ap in airportCodes) {
        sitemap += `  <url>
    <loc>${SITE_URL}/airport/${airportCodes[ap]}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
    sitemap += '</urlset>';
    fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
    console.log('Generated sitemap.xml');

    // 5. Generate robots.txt
    console.log('Generating robots.txt...');
    const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
    fs.writeFileSync(path.join(__dirname, 'robots.txt'), robots, 'utf8');
    console.log('Generated robots.txt');

    // 6. Export datasets (CSV & JSON)
    console.log('Exporting datasets for E-E-A-T...');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // JSON Dataset (filtered records for 2024 to latest)
    const exportRecords = allRecords.filter(r => {
        const val = r.year * 100 + r.month;
        return val >= (DEFAULT_START_YEAR * 100 + DEFAULT_START_MONTH);
    });
    fs.writeFileSync(
        path.join(dataDir, 'flight_data.json'), 
        JSON.stringify(exportRecords, null, 2), 
        'utf8'
    );
    console.log('Exported data/flight_data.json');

    // CSV Dataset
    let csv = 'year,month,airport,destination,airline,flights,seats,passengers,load_factor\n';
    exportRecords.forEach(r => {
        csv += `${r.year},${r.month},"${r.airport}","${r.destination}","${r.airline}",${r.flights},${r.totalSeats},${r.passengers},${r.loadFactor.toFixed(4)}\n`;
    });
    fs.writeFileSync(path.join(dataDir, 'flight_data.csv'), csv, 'utf8');
    console.log('Exported data/flight_data.csv');

    console.log('Static site build pipeline completed successfully!');
}

build();
