/**
 * Static Site Generation (SSG) Pre-rendering Script
 * Reads raw flight data and generates SEO/AIEO-optimized static HTML pages.
 * Output: index.html (home), airport/{code}/index.html, airline/{code}/index.html, about/index.html, sitemap.xml, robots.txt, datasets, and llms.txt.
 */

const fs = require('fs');
const path = require('path');
const { calculateInsightsData, generateStaticInsightsHTML } = require('./js/insights.js');

const SITE_URL = 'https://flightdata2.meshthings.com';

const airportCodes = {
    '桃園國際機場': 'tpe',
    '高雄國際機場': 'khh',
    '臺北松山機場': 'tsa',
    '臺中清泉崗機場': 'rmq',
    '臺南機場': 'tnn',
    '花蓮機場': 'hun'
};

const airlineSlugCodes = {
    '中華': 'cal',
    '長榮': 'eva',
    '星宇': 'starlux',
    '台灣虎航': 'tiger'
};

const airlineFullNames = {
    '中華': '中華航空',
    '長榮': '長榮航空',
    '星宇': '星宇航空',
    '台灣虎航': '台灣虎航'
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
 * Generate rich JSON-LD structure schemas (Dataset, FAQPage, BreadcrumbList, DataCatalog)
 */
function generateJsonLd(targetAirport, targetAirline, pageTitle, pageDesc, canonicalUrl, insightsData, latestYear, latestMonth) {
    const latestYM = `${latestYear}-${String(latestMonth).padStart(2, '0')}`;
    const startYM = `${DEFAULT_START_YEAR}-${String(DEFAULT_START_MONTH).padStart(2, '0')}`;
    
    // 1. Dataset mapping
    let datasetName = '全台主要機場航空載客率數據庫';
    let datasetDesc = '包含台灣各主要機場起降班次、座位數及載客人數的月度統計數據。';
    let fileCode = 'all';
    
    if (targetAirport) {
        datasetName = `${targetAirport}航空載客率數據庫`;
        datasetDesc = `包含${targetAirport}起降班次、座位數及載客人數的月度統計數據。`;
        fileCode = `airport-${airportCodes[targetAirport]}`;
    } else if (targetAirline) {
        const fullName = airlineFullNames[targetAirline] || targetAirline;
        datasetName = `${fullName}航空載客率數據庫`;
        datasetDesc = `包含${fullName}起降班次、座位數及載客人數的月度統計數據。`;
        fileCode = `airline-${airlineSlugCodes[targetAirline]}`;
    }
    
    const csvUrl = `${SITE_URL}/data/flight_data_${fileCode}.csv`;
    const jsonUrl = `${SITE_URL}/data/flight_data_${fileCode}.json`;
    
    const datasetSchema = {
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": datasetName,
        "description": datasetDesc,
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "temporalCoverage": `${startYM}-01/${latestYM}-01`,
        "spatialCoverage": {
            "@type": "Place",
            "name": targetAirport || "Taiwan"
        },
        "publisher": {
            "@type": "Organization",
            "name": "民航局"
        },
        "distribution": [
            {
                "@type": "DataDownload",
                "encodingFormat": "text/csv",
                "contentUrl": csvUrl
            },
            {
                "@type": "DataDownload",
                "encodingFormat": "application/json",
                "contentUrl": jsonUrl
            }
        ]
    };
    
    // Add potential action for Download
    datasetSchema.potentialAction = {
        "@type": "DownloadAction",
        "name": `下載${datasetName} CSV`,
        "target": {
            "@type": "EntryPoint",
            "urlTemplate": csvUrl,
            "encodingType": "text/csv",
            "actionPlatform": ["http://schema.org/DesktopWebPlatform", "http://schema.org/MobileWebPlatform"]
        }
    };
    
    // 2. Breadcrumbs
    const breadcrumbList = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "首頁",
                "item": SITE_URL
            }
        ]
    };
    
    if (targetAirport) {
        breadcrumbList.itemListElement.push({
            "@type": "ListItem",
            "position": 2,
            "name": targetAirport,
            "item": canonicalUrl
        });
    } else if (targetAirline) {
        const fullName = airlineFullNames[targetAirline] || targetAirline;
        breadcrumbList.itemListElement.push({
            "@type": "ListItem",
            "position": 2,
            "name": fullName,
            "item": canonicalUrl
        });
    }
    
    // 3. Dynamic FAQ Page based on real insights
    const kpis = insightsData.kpis;
    const fullNameSubject = targetAirport || (targetAirline ? airlineFullNames[targetAirline] : null) || "台灣主要機場";
    
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": `${fullNameSubject}的平均載客率（座位利用率）是多少？`,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": `根據統計期間（${DEFAULT_START_YEAR}年${DEFAULT_START_MONTH}月至${latestYear}年${latestMonth}月）的真實數據，${fullNameSubject}累計起降班次達 ${kpis.totalFlights.toLocaleString()} 班，總載客人數達 ${kpis.totalPassengers.toLocaleString()} 人次，平均座位載客率為 ${kpis.avgLoadFactor.toFixed(1)}%。`
                }
            }
        ]
    };
    
    if (kpis.peakMonth !== '-') {
        const parts = kpis.peakMonth.split('-');
        const monthMap = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6', '07': '7', '08': '8', '09': '9', '10': '10', '11': '11', '12': '12' };
        const mName = monthMap[parts[1]] || parts[1];
        faqSchema.mainEntity.push({
            "@type": "Question",
            "name": `${fullNameSubject}在統計期間載客率最高的是哪一個月？`,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": `${fullNameSubject}的最旺月份落於 ${parts[0]}年${mName}月，該月全體航空公司平均座位利用率高達 ${kpis.peakMonthLF.toFixed(1)}%。`
            }
        });
    }
    
    if (insightsData.topRoutes && insightsData.topRoutes.length > 0) {
        const topRoute = insightsData.topRoutes[0];
        faqSchema.mainEntity.push({
            "@type": "Question",
            "name": `${fullNameSubject}主要的熱門目的地是哪裡？`,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": `統計期間最熱門的目的地為 ${topRoute.name}，佔該統計總運量的 ${topRoute.pct.toFixed(1)}%，累計旅客人次達 ${topRoute.passengers.toLocaleString()} 人，該目的地平均載客率為 ${topRoute.avgLF.toFixed(1)}%。`
            }
        });
    }

    const schemas = [
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": pageTitle,
            "description": pageDesc,
            "url": canonicalUrl,
            "about": datasetSchema
        },
        faqSchema
    ];

    if (breadcrumbList.itemListElement.length > 1) {
        schemas.push(breadcrumbList);
    }
    
    // 4. DataCatalog (Only on Homepage)
    if (!targetAirport && !targetAirline) {
        const dataCatalog = {
            "@context": "https://schema.org",
            "@type": "DataCatalog",
            "name": "MeshThings 台灣航班數據目錄",
            "description": "包含台灣主要機場（桃園、松山、台中、高雄、台南）與主要航空公司（中華、長榮、星宇、虎航）的月度載客率開放數據目錄。",
            "url": SITE_URL,
            "dataset": []
        };
        
        for (const ap in airportCodes) {
            dataCatalog.dataset.push({
                "@type": "Dataset",
                "name": `${ap}航空載客率數據庫`,
                "url": `${SITE_URL}/airport/${airportCodes[ap]}/`
            });
        }
        
        for (const al in airlineSlugCodes) {
            const fullName = airlineFullNames[al];
            dataCatalog.dataset.push({
                "@type": "Dataset",
                "name": `${fullName}航空載客率數據庫`,
                "url": `${SITE_URL}/airline/${airlineSlugCodes[al]}/`
            });
        }
        
        schemas.push(dataCatalog);
    }

    return schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s, null, 2)}</script>`).join('\n');
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

    console.log(`Global date range for pre-rendering: 2024-01 to ${latestRecord.yearMonth}`);

    // Define function to generate page
    function generatePage(targetAirport, targetAirline, outputFilePath, relativeUrlPath) {
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

        // Filter by airline if specified
        if (targetAirline) {
            filteredRecords = filteredRecords.filter(r => r.airline === targetAirline);
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
            pageDesc = `${targetAirport}載客率與航班數據分析，包含熱門目的地排行榜、座位利用率年度熱力圖與航空公司市佔率。統計期間累計旅客人次達 ${insightsData.kpis.totalPassengers.toLocaleString()} 人，平均載客率 ${insightsData.kpis.avgLoadFactor.toFixed(1)}%。`;
            
            breadcrumbHtml = `
            <div class="breadcrumb" style="margin-bottom: var(--space-4); font-size: 0.875rem; color: var(--color-text-secondary);">
                <a href="/" style="color: var(--color-primary); text-decoration: none;">首頁</a> &gt; 
                <span style="color: var(--color-text-primary); font-weight: 500;">${targetAirport}</span>
            </div>`;
        } else if (targetAirline) {
            const fullName = airlineFullNames[targetAirline] || targetAirline;
            pageTitle = `${fullName}載客率與航班數據分析儀表板`;
            pageDesc = `${fullName}載客率與航班數據分析，包含執飛航線排名、座位利用率年度熱力圖與載客趨勢分析。統計期間累計旅客人次達 ${insightsData.kpis.totalPassengers.toLocaleString()} 人，平均載客率 ${insightsData.kpis.avgLoadFactor.toFixed(1)}%。`;
            
            breadcrumbHtml = `
            <div class="breadcrumb" style="margin-bottom: var(--space-4); font-size: 0.875rem; color: var(--color-text-secondary);">
                <a href="/" style="color: var(--color-primary); text-decoration: none;">首頁</a> &gt; 
                <span style="color: var(--color-text-primary); font-weight: 500;">${fullName}</span>
            </div>`;
        }

        let html = templateHtml;

        // Inject page metadata
        html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
        html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${pageDesc}">`);

        // Inject Canonical URL & OG Meta Tags
        const canonicalUrl = `${SITE_URL}${relativeUrlPath}`;
        const ogTags = `
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${pageDesc}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${SITE_URL}/og-card.png">
    <meta name="twitter:card" content="summary_large_image">`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        // Inject dynamic JSON-LD schemas
        const jsonLdHtml = generateJsonLd(targetAirport, targetAirline, pageTitle, pageDesc, canonicalUrl, insightsData, latestYear, latestMonth);
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

        // Replace CSV/JSON download urls with specialized file paths
        let fileCode = 'all';
        if (targetAirport) {
            fileCode = `airport-${airportCodes[targetAirport]}`;
        } else if (targetAirline) {
            fileCode = `airline-${airlineSlugCodes[targetAirline]}`;
        }
        html = html.replace('/data/flight_data.csv', `/data/flight_data_${fileCode}.csv`);
        html = html.replace('/data/flight_data.json', `/data/flight_data_${fileCode}.json`);

        // Update data quality details
        const latestDateStr = `${latestYear}-${String(latestMonth).padStart(2, '0')}-01`;
        html = html.replace(/<dd id="dq-update-time">[\s\S]*?<\/dd>/, `<dd id="dq-update-time"><time datetime="${latestDateStr}">${latestYear}年${latestMonth}月</time></dd>`);

        // Save output file
        const dir = path.dirname(outputFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputFilePath, html, 'utf8');
        console.log(`Generated page: ${outputFilePath}`);
    }

    // 2. Generate HomePage
    generatePage(null, null, path.join(__dirname, 'index.html'), '/');

    // 3. Generate Airport Pages
    for (const airportName in airportCodes) {
        const code = airportCodes[airportName];
        generatePage(
            airportName, 
            null,
            path.join(__dirname, 'airport', code, 'index.html'), 
            `/airport/${code}/`
        );
    }

    // 4. Generate Airline Pages (Programmatic SEO)
    for (const airlineName in airlineSlugCodes) {
        const code = airlineSlugCodes[airlineName];
        generatePage(
            null,
            airlineName,
            path.join(__dirname, 'airline', code, 'index.html'),
            `/airline/${code}/`
        );
    }

    // 5. Generate sitemap.xml
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
  <url>
    <loc>${SITE_URL}/about/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
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
    for (const al in airlineSlugCodes) {
        sitemap += `  <url>
    <loc>${SITE_URL}/airline/${airlineSlugCodes[al]}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
    sitemap += '</urlset>';
    fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap, 'utf8');
    console.log('Generated sitemap.xml');

    // 6. Generate robots.txt
    console.log('Generating robots.txt...');
    const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
    fs.writeFileSync(path.join(__dirname, 'robots.txt'), robots, 'utf8');
    console.log('Generated robots.txt');

    // 7. Export datasets (CSV & JSON)
    console.log('Exporting datasets for E-E-A-T...');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const exportRecords = allRecords.filter(r => {
        const val = r.year * 100 + r.month;
        return val >= (DEFAULT_START_YEAR * 100 + DEFAULT_START_MONTH);
    });

    // Helper to write CSV/JSON datasets
    function exportDataset(records, code) {
        // JSON
        fs.writeFileSync(
            path.join(dataDir, `flight_data_${code}.json`), 
            JSON.stringify(records, null, 2), 
            'utf8'
        );
        // CSV
        let csv = 'year,month,airport,destination,airline,flights,seats,passengers,load_factor\n';
        records.forEach(r => {
            csv += `${r.year},${r.month},"${r.airport}","${r.destination}","${r.airline}",${r.flights},${r.totalSeats},${r.passengers},${r.loadFactor.toFixed(4)}\n`;
        });
        fs.writeFileSync(path.join(dataDir, `flight_data_${code}.csv`), csv, 'utf8');
    }

    // Export full
    exportDataset(exportRecords, 'all');
    console.log('Exported data/flight_data_all.csv and .json');

    // Export per airport
    for (const ap in airportCodes) {
        const code = airportCodes[ap];
        const apRecords = exportRecords.filter(r => r.airport === ap);
        exportDataset(apRecords, `airport-${code}`);
        console.log(`Exported data/flight_data_airport-${code}.csv and .json`);
    }

    // Export per airline
    for (const al in airlineSlugCodes) {
        const code = airlineSlugCodes[al];
        const alRecords = exportRecords.filter(r => r.airline === al);
        exportDataset(alRecords, `airline-${code}`);
        console.log(`Exported data/flight_data_airline-${code}.csv and .json`);
    }

    // 8. Generate llms.txt & llms-full.txt
    console.log('Generating llms.txt and llms-full.txt...');
    const llmsText = `# MeshThings FlightData (台灣航班載客率數據分析)

此站點提供台灣主要機場與主要航空公司的載客率、起降航班與座位利用率統計。所有資料均來自民航局開放資料，包含 2024 年至今的詳細月度數據。

## 主要頁面與資料集 (Dataset URL)
- 首頁 (全台機場統計): ${SITE_URL}/
- 桃園國際機場 (TPE): ${SITE_URL}/airport/tpe/
- 高雄國際機場 (KHH): ${SITE_URL}/airport/khh/
- 臺北松山機場 (TSA): ${SITE_URL}/airport/tsa/
- 臺中清泉崗機場 (RMQ): ${SITE_URL}/airport/rmq/
- 臺南機場 (TNN): ${SITE_URL}/airport/tnn/
- 花蓮機場 (Hun): ${SITE_URL}/airport/hun/

## 航空公司專屬分析 (Airline Analytics)
- 中華航空 (CAL): ${SITE_URL}/airline/cal/
- 長榮航空 (EVA): ${SITE_URL}/airline/eva/
- 星宇航空 (STARLUX): ${SITE_URL}/airline/starlux/
- 台灣虎航 (TIGER): ${SITE_URL}/airline/tiger/

## 開放數據下載 (Open Data Download)
- 全台載客數據 CSV: ${SITE_URL}/data/flight_data_all.csv
- 全台載客數據 JSON: ${SITE_URL}/data/flight_data_all.json
- 各機場與航空公司專屬數據，可藉由該頁面中的下載按鈕取得。

## 關於與方法論 (E-E-A-T & Methodology)
- 關於本站、計算公式及數據驗證: ${SITE_URL}/about/
`;
    fs.writeFileSync(path.join(__dirname, 'llms.txt'), llmsText, 'utf8');
    fs.writeFileSync(path.join(__dirname, 'llms-full.txt'), llmsText, 'utf8');
    console.log('Generated llms.txt and llms-full.txt successfully!');

    console.log('Static site build pipeline completed successfully!');
}

build();
