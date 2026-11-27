/**
 * Static Site Generation (SSG) Pre-rendering Script
 * Reads raw flight data and generates SEO/AIEO-optimized static HTML pages.
 * Output: index.html (home), airport/{code}/index.html, airline/{code}/index.html, about/index.html, sitemap.xml, robots.txt, datasets, and llms.txt.
 */

const fs = require('fs');
const path = require('path');
const { calculateInsightsData, generateStaticInsightsHTML } = require('./js/insights.js');
const { generateMonthlyReport } = require('./scripts/generate_monthly_report.js');
const { loadDestinationMap, computeRouteInsights, renderRouteRankingsSection, routeFaq, routeItemLists, shortAirport } = require('./scripts/route_insights.js');
const { generateHolidayPreviews } = require('./scripts/generate_holiday_preview.js');
const { GA_SNIPPET, ensureGa } = require('./scripts/ga.js');

const SITE_URL = 'https://flightdata2.meshthings.com';

// Custom parsing of .env if it exists locally
if (fs.existsSync(path.join(__dirname, '.env'))) {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    envFile.split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
                value = value.substring(1, value.length - 1);
            } else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value.trim();
        }
    });
}

const ADSENSE_CLIENT = process.env.ADSENSE_CLIENT || 'ca-pub-9747455231872729';
const ADSENSE_SLOT_INSIGHTS = process.env.ADSENSE_SLOT_INSIGHTS || 'REPLACE_WITH_INSIGHTS_SLOT_ID';
const ADSENSE_SLOT_TABLE = process.env.ADSENSE_SLOT_TABLE || 'REPLACE_WITH_TABLE_SLOT_ID';

function isValidAdSlot(slotId) {
    if (!slotId) return false;
    const str = String(slotId).trim();
    if (str === '') return false;
    if (str.includes('REPLACE_WITH')) return false;
    return /^\d+$/.test(str);
}

function generateAdSlotHTML(position, client, slotId, isProd) {
    const isValid = isValidAdSlot(slotId);
    const positionAttr = position === 'insights' ? 'insights' : 'table';
    const label = position === 'insights' ? '智慧洞察後方' : '詳細表格前';

    if (isValid) {
        return `<aside class="adsense-slot adsense-slot--inline" aria-label="廣告" data-ad-position="${positionAttr}">
    <div class="adsense-label">廣告</div>
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="${client}"
         data-ad-slot="${String(slotId).trim()}"
         data-ad-format="auto"
         data-full-width-responsive="true">
    </ins>
</aside>`;
    } else {
        if (!isProd) {
            return `<aside class="adsense-slot adsense-slot--inline adsense-slot--preview" aria-label="廣告位置預覽" data-ad-position="${positionAttr}" style="border: 1px dashed var(--color-border-bright); min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.03); margin: 28px auto; padding: 12px; border-radius: 16px; width: 100%;">
    <div class="adsense-label">廣告預覽 (無效 Slot ID)</div>
    <div style="font-size: 0.85rem; color: var(--color-text-secondary);">AdSense 廣告位置：${label}</div>
</aside>`;
        } else {
            return `<!-- AdSense slot placeholder for ${positionAttr} (missing or invalid slot ID) -->`;
        }
    }
}


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

function buildPageSeo(targetAirport, targetAirline, insightsData, latestYear, latestMonth) {
    const formattedMonth = String(latestMonth).padStart(2, '0');
    const timeLabel = `${latestYear}年${formattedMonth}月`;

    if (targetAirport) {
        const code = airportCodes[targetAirport].toUpperCase();
        return {
            title: `${targetAirport}載客率查詢｜${latestYear}年最新數據 (更新至${latestMonth}月)｜${code} 航班分析`,
            heading: `${targetAirport}載客率查詢`,
            description: `【${latestYear}最新數據】查詢${targetAirport}月度載客率、航班數、座位數與熱門航線排名，數據更新至${timeLabel}。支援依航空公司與目的地分析座位利用率。`,
            summaryTitle: `${targetAirport}航班載客率摘要 (${timeLabel}更新)`,
            summaryText: `${targetAirport}頁面提供月度載客率、航班數、座位供給、實際旅客量與熱門航線分析，已更新至${timeLabel}最新民航局開放資料。`
        };
    }

    if (targetAirline) {
        const fullName = airlineFullNames[targetAirline] || targetAirline;
        return {
            title: `${fullName}載客率查詢｜${latestYear}年最新數據 (更新至${latestMonth}月)｜航班載客率分析`,
            heading: `${fullName}載客率查詢`,
            description: `【${latestYear}最新數據】查詢${fullName}月度載客率、執飛航線、座位數與旅客量趨勢，數據更新至${timeLabel}。支援熱門目的地與座位利用率比較。`,
            summaryTitle: `${fullName}航線載客率摘要 (${timeLabel}更新)`,
            summaryText: `${fullName}頁面提供執飛航線、月度載客率、座位供給、旅客量趨勢與熱門目的地分析，已更新至${timeLabel}最新數據。`
        };
    }

    return {
        title: `台灣航空載客率查詢｜${latestYear}年最新航班數據分析 (更新至${latestMonth}月)`,
        heading: '台灣航空載客率查詢',
        description: `【${latestYear}最新數據】查詢台灣主要機場與航空公司的月度載客率、航班數、座位數與熱門航線排名，數據更新至${timeLabel}，適合航空趨勢分析。`,
        summaryTitle: `台灣航空載客率與熱門航線摘要 (${timeLabel}更新)`,
        summaryText: `本頁提供台灣主要機場與航空公司的載客率、航班數、座位供給、旅客量與熱門航線分析，已更新至${timeLabel}最新數據，支援快速比較座位利用率。`
    };
}

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

        return `<tr data-label="年月">
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
            </tr>`;
    }).join('\n');
}

/**
 * Generate rich JSON-LD structure schemas (Dataset, FAQPage, BreadcrumbList, DataCatalog)
 */
function generateJsonLd(targetAirport, targetAirline, pageTitle, pageDesc, canonicalUrl, insightsData, latestYear, latestMonth, allRecords = [], routeInfo = null) {
    const latestYM = `${latestYear}-${String(latestMonth).padStart(2, '0')}`;
    const startYM = `${DEFAULT_START_YEAR}-${String(DEFAULT_START_MONTH).padStart(2, '0')}`;

    // 1. Dataset mapping
    let datasetName = '全台主要機場航空載客率數據庫';
    let datasetDesc = '本數據集提供台灣主要機場的航空載客率統計數據，內容包含月度起降航班數、總座位數、實際載客人數與平均載客率。數據適合航空產業趨勢分析、學術研究及數據視覺化使用。';
    let fileCode = 'all';

    if (targetAirport) {
        datasetName = `${targetAirport}航空載客率數據庫`;
        datasetDesc = `本數據集提供${targetAirport}的航空載客率統計數據，內容包含月度起降航班數、總座位數、實際載客人數與平均載客率。數據適合航空產業趨勢分析、學術研究及數據視覺化使用。`;
        fileCode = `airport-${airportCodes[targetAirport]}`;
    } else if (targetAirline) {
        const fullName = airlineFullNames[targetAirline] || targetAirline;
        datasetName = `${fullName}航空載客率數據庫`;
        datasetDesc = `本數據集提供${fullName}的航空載客率統計數據，內容包含該航空公司在台灣各航線的月度起降航班數、總座位數與實際載客人數。數據適合航空產業趨勢分析使用。`;
        fileCode = `airline-${airlineSlugCodes[targetAirline]}`;
    }

    const csvUrl = `${SITE_URL}/data/flight_data_${fileCode}.csv`;
    const jsonUrl = `${SITE_URL}/data/flight_data_${fileCode}.json`;

    const datasetSchema = {
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": datasetName,
        "description": datasetDesc,
        "license": "https://data.gov.tw/license",
        "isBasedOn": "https://data.gov.tw/dataset/47492",
        "temporalCoverage": `${startYM}-01/${latestYM}-01`,
        "spatialCoverage": {
            "@type": "Place",
            "name": targetAirport || "Taiwan"
        },
        "publisher": {
            "@type": "Organization",
            "name": "交通部民用航空局",
            "url": "https://data.gov.tw/dataset/47492"
        },
        "creator": {
            "@type": "Organization",
            "name": "交通部民用航空局",
            "url": "https://www.caa.gov.tw/"
        },
        "variableMeasured": ["載客率", "航班數", "總座位數", "載客人數"],
        "keywords": ["台灣航空", "載客率", "航班數據", "機場統計"],
        "isAccessibleForFree": true,
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

    // Latest-month route rankings (see scripts/route_insights.js)
    if (routeInfo && routeInfo.data) {
        for (const f of routeFaq(routeInfo.data, routeInfo.subject)) {
            faqSchema.mainEntity.push({
                "@type": "Question",
                "name": f.q,
                "acceptedAnswer": { "@type": "Answer", "text": f.a }
            });
        }
    }

    const schemas = [
        datasetSchema,
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": pageTitle,
            "description": pageDesc,
            "url": canonicalUrl,
            "isPartOf": {
                "@type": "WebSite",
                "name": "台灣航空載客率查詢",
                "alternateName": "MeshThings FlightData",
                "url": SITE_URL
            }
        },
        faqSchema
    ];

    if (breadcrumbList.itemListElement.length > 1) {
        schemas.push(breadcrumbList);
    }

    if (routeInfo && routeInfo.data) {
        schemas.push(...routeItemLists(routeInfo.data, routeInfo.subject, canonicalUrl));
    }

    // 4. DataCatalog (Only on Homepage)
    if (!targetAirport && !targetAirline) {
        schemas.push({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "台灣航空載客率查詢",
            "alternateName": [
                "MeshThings FlightData",
                "台灣航空載客率數據分析"
            ],
            "url": SITE_URL,
            "inLanguage": "zh-TW"
        });

        const dataCatalog = {
            "@context": "https://schema.org",
            "@type": "DataCatalog",
            "name": "MeshThings 台灣航班數據目錄",
            "description": "包含台灣主要機場（桃園、松山、台中、高雄、台南、花蓮）與主要航空公司（中華、長榮、星宇、虎航）的月度載客率開放數據目錄。",
            "url": SITE_URL,
            "dataset": []
        };

        for (const ap in airportCodes) {
            const apRecs = allRecords.filter(r => r.airport === ap).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
            const apLatest = apRecs.length > 0 ? apRecs[0] : { year: latestYear, month: latestMonth };
            const apLatestYM = `${apLatest.year}-${String(apLatest.month).padStart(2, '0')}`;
            dataCatalog.dataset.push({
                "@type": "Dataset",
                "name": `${ap}航空載客率數據庫`,
                "description": `本數據集提供${ap}的航空載客率統計數據，內容包含月度起降航班數、總座位數、實際載客人數與平均載客率，資料來源為交通部民用航空局。`,
                "license": "https://data.gov.tw/license",
                "isBasedOn": "https://data.gov.tw/dataset/47492",
                "temporalCoverage": `${startYM}-01/${apLatestYM}-01`,
                "url": `${SITE_URL}/airport/${airportCodes[ap]}/`
            });
        }

        for (const al in airlineSlugCodes) {
            const alRecs = allRecords.filter(r => r.airline === al).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
            const alLatest = alRecs.length > 0 ? alRecs[0] : { year: latestYear, month: latestMonth };
            const alLatestYM = `${alLatest.year}-${String(alLatest.month).padStart(2, '0')}`;
            const fullName = airlineFullNames[al];
            dataCatalog.dataset.push({
                "@type": "Dataset",
                "name": `${fullName}航空載客率數據庫`,
                "description": `本數據集提供${fullName}的航空載客率統計數據，內容包含該航空公司在台灣各航線的月度起降航班數、總座位數與實際載客人數，資料來源為交通部民用航空局。`,
                "license": "https://data.gov.tw/license",
                "isBasedOn": "https://data.gov.tw/dataset/47492",
                "temporalCoverage": `${startYM}-01/${alLatestYM}-01`,
                "url": `${SITE_URL}/airline/${airlineSlugCodes[al]}/`
            });
        }

        schemas.push(dataCatalog);
    }

    return schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s, null, 2)}</script>`).join('\n');
}

function escapeHtmlAttr(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Scan insights/<slug>/index.html (monthly reports + feature articles).
 * lastmod = the page's own JSON-LD dateModified (fallback: datePublished, footer build <time>, then build date),
 * so untouched older reports keep their real modification date instead of "today".
 */
function collectInsightPages(insightsDir, fallbackDate) {
    if (!fs.existsSync(insightsDir)) return [];
    const pages = [];
    for (const slug of fs.readdirSync(insightsDir)) {
        const file = path.join(insightsDir, slug, 'index.html');
        if (!fs.statSync(path.join(insightsDir, slug)).isDirectory() || !fs.existsSync(file)) continue;
        const html = fs.readFileSync(file, 'utf8');
        const textOf = (re) => { const m = html.match(re); return m ? m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''; };
        const dateOf = (re) => { const m = html.match(re); return m ? m[1] : ''; };
        const monthly = slug.match(/^(\d{4})-(\d{2})-taiwan-aviation-monthly-report$/);
        const datePublished = dateOf(/"datePublished":\s*"(\d{4}-\d{2}-\d{2})/);
        const lastmod = dateOf(/"dateModified":\s*"(\d{4}-\d{2}-\d{2})/) || datePublished
            || dateOf(/<time datetime="(\d{4}-\d{2}-\d{2})">/) || fallbackDate;
        pages.push({
            slug,
            path: `/insights/${slug}/`,
            type: monthly ? 'monthly' : 'feature',
            sortKey: monthly ? `${monthly[1]}-${monthly[2]}` : (datePublished || lastmod).slice(0, 7),
            title: textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || textOf(/<title>([\s\S]*?)<\/title>/i) || slug,
            description: (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '',
            lastmod
        });
    }
    return pages.sort((a, b) => b.sortKey.localeCompare(a.sortKey) || b.slug.localeCompare(a.slug));
}

function renderInsightsIndex(pages) {
    const canonical = `${SITE_URL}/insights/`;
    const title = '台灣航空月報與市場洞察總覽｜各期月報列表';
    const desc = '依月份整理台灣航空數據月報與市場洞察專題：航班、座位、旅客、載客率與主要機場、航空公司趨勢，資料來源為交通部民用航空局。';
    const item = (p) => `<li><a href="${p.path}">${escapeHtmlAttr(p.title)}</a>${p.description ? `<p>${p.description}</p>` : ''}<small>更新：<time datetime="${p.lastmod}">${p.lastmod}</time></small></li>`;
    const monthly = pages.filter(p => p.type === 'monthly');
    const features = pages.filter(p => p.type === 'feature');
    const jsonLd = [
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: canonical, inLanguage: 'zh-Hant-TW',
          mainEntity: { '@type': 'ItemList', itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + p.path, name: p.title })) } },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首頁', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '月報與洞察', item: canonical }] }
    ];
    const css = ':root{--bg:#f6ecd8;--paper:#fffaf1;--line:#dec7a2;--text:#4a3427;--muted:#7c6654;--accent:#c67c4d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#3b2b20;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;line-height:1.7}a{color:#8e4f2c}.wrap{max-width:880px;margin:auto;padding:0 20px}.nav{background:#fbf5ea;border-bottom:1px solid var(--line)}.navin{max-width:880px;margin:auto;padding:15px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:10px;font-weight:900;color:var(--text);text-decoration:none}.logo{width:40px;height:40px;border-radius:13px;background:var(--accent);color:#fff;display:grid;place-items:center}.navlinks{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;font-weight:800}.navlinks a{text-decoration:none}h1{font-size:clamp(30px,5vw,44px);line-height:1.15;margin:40px 0 10px}.lead{color:var(--muted)}h2{margin-top:32px}.list{list-style:none;padding:0;display:grid;gap:12px}.list li{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:18px 20px}.list a{font-size:19px;font-weight:900;text-decoration:none}.list p{margin:6px 0;font-size:14px}.list small{font-size:12px;color:var(--muted)}.foot{margin-top:44px;padding:20px 0;border-top:1px solid #d5bc95;font-size:12px;color:#77604e}';
    return `<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}"><meta name="robots" content="index,follow"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE_URL}/og-card.png"><meta property="og:locale" content="zh_TW"><meta name="twitter:card" content="summary_large_image">
${GA_SNIPPET}
${jsonLd.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
<style>${css}</style></head><body>
<header class="nav"><nav class="navin" aria-label="主要導航"><a class="brand" href="/"><span class="logo">✈</span><span>台灣航空數據月報</span></a><div class="navlinks"><a href="/">首頁</a><a href="/about/">方法論</a><a href="/insights/" aria-current="page">全部月報</a></div></nav></header>
<main class="wrap"><h1>台灣航空月報與市場洞察</h1><p class="lead">依資料月份由新到舊排列。每期月報整理當月航班、座位、旅客與載客率，並與去年同期比較。</p>
<section aria-labelledby="monthly-title"><h2 id="monthly-title">各期月報</h2><ul class="list">${monthly.map(item).join('')}</ul></section>
${features.length ? `<section aria-labelledby="feature-title"><h2 id="feature-title">專題分析</h2><ul class="list">${features.map(item).join('')}</ul></section>` : ''}
</main>
<footer class="wrap foot"><p>資料來源：<a href="https://www.caa.gov.tw/article.aspx?a=1752&amp;lang=1" rel="nofollow">交通部民用航空局</a> ｜ <a href="/about/">方法論</a> ｜ <a href="/privacy/">隱私權政策</a></p></footer>
</body></html>
`;
}

/**
 * Main build pipeline
 */
function build() {
    console.log('Starting static site build pipeline...');

    // 1. Load raw flight data memory-efficiently
    console.log('Loading flight data via fs.readFileSync & JSON.parse...');
    let flightDataObj;
    try {
        const filePath = path.join(__dirname, 'data', 'flight_data_new.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const start = content.indexOf('{');
        const end = content.indexOf('const DESTINATION_MAP');
        if (start === -1 || end === -1) {
            throw new Error('Could not find data boundary markers in JS file');
        }
        let jsonStr = content.substring(start, end).trim();
        if (jsonStr.endsWith(';')) {
            jsonStr = jsonStr.slice(0, -1);
        }
        flightDataObj = JSON.parse(jsonStr);
        if (!flightDataObj) {
            throw new Error('Parsed flightData object is undefined');
        }
    } catch (e) {
        console.error('Failed to load flight data file memory-efficiently:', e);
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
    let templateHtml = fs.readFileSync(templatePath, 'utf8');

    // Find date range boundaries
    const sortedRecords = [...allRecords].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    const latestRecord = sortedRecords[0];
    const globalLatestYear = latestRecord.year;
    const globalLatestMonth = latestRecord.month;

    console.log(`Global date range for pre-rendering: 2024-01 to ${latestRecord.yearMonth}`);

    const destinationMap = loadDestinationMap(__dirname);
    const buildDate = new Date().toISOString().split('T')[0];

    // Holiday previews (e.g. /insights/2027-cny-japan-flights/), driven by data/holiday_previews.json.
    const latestReportPath = `/insights/${globalLatestYear}-${String(globalLatestMonth).padStart(2, '0')}-taiwan-aviation-monthly-report/`;
    const holidayPreviews = generateHolidayPreviews(allRecords, { root: __dirname, siteUrl: SITE_URL, destinationMap, buildDate, latestReportPath });

    // Generate the latest monthly report from the exact same dataset used by all pages.
    const monthlyReport = generateMonthlyReport(allRecords, { root: __dirname, siteUrl: SITE_URL, featureLinks: holidayPreviews });
    const monthlyReportPath = monthlyReport.path;
    templateHtml = templateHtml.replace(
        '<!-- LATEST_MONTHLY_REPORT_LINK -->',
        `<li><a href="${monthlyReportPath}" class="nav-link">📰 ${monthlyReport.month} 月月報</a></li>
                        <li><a href="/insights/" class="nav-link">🗂️ 全部月報</a></li>`
    );

    // Define function to generate page
    function generatePage(targetAirport, targetAirline, outputFilePath, relativeUrlPath) {
        let targetRecords = allRecords;
        if (targetAirport) {
            targetRecords = allRecords.filter(r => r.airport === targetAirport);
        } else if (targetAirline) {
            targetRecords = allRecords.filter(r => r.airline === targetAirline);
        }

        // Determine page-specific latest year and month
        const sortedTarget = [...targetRecords].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
        const pageLatestRecord = sortedTarget.length > 0 ? sortedTarget[0] : latestRecord;
        const pageLatestYear = pageLatestRecord.year;
        const pageLatestMonth = pageLatestRecord.month;

        // Filter by date range (2024-01 to page's latest month)
        const startVal = DEFAULT_START_YEAR * 100 + DEFAULT_START_MONTH;
        const endVal = pageLatestYear * 100 + pageLatestMonth;

        const filteredRecords = targetRecords.filter(r => {
            const currentVal = r.year * 100 + r.month;
            return currentVal >= startVal && currentVal <= endVal;
        });

        // Latest-month route rankings for this page's scope
        const routeScope = targetAirport ? 'airport' : (targetAirline ? 'airline' : 'all');
        const routeSubject = targetAirport ? `${shortAirport(targetAirport)}機場` : (targetAirline ? (airlineFullNames[targetAirline] || targetAirline) : '全台');
        const routeData = computeRouteInsights(filteredRecords, { scope: routeScope, destinationMap });
        const routeExtraLinks = routeScope === 'all'
            ? Object.keys(airportCodes).map(ap => ({ href: `/airport/${airportCodes[ap]}/#route-rankings`, text: `${shortAirport(ap)}機場航線排行` }))
            : [{ href: '/#route-rankings', text: '全台航線排行' }, { href: monthlyReport.path, text: `${monthlyReport.month} 月月報` }];
        const routeSectionHtml = renderRouteRankingsSection(routeData, {
            subject: routeSubject, extraLinks: routeExtraLinks,
            pagePath: relativeUrlPath, pageAirport: targetAirport || ''
        });
        // Holiday entry sits right under the search summary (above the filters), not inside the
        // rankings, which now live below the data table.
        const holidayEntryHtml = routeScope === 'all'
            ? holidayPreviews.filter(h => h.active)
                .map(h => `<p class="holiday-entry">🧧 連假預告：<a href="${h.path}">${escapeHtmlAttr(h.title)}</a></p>`).join('\n')
            : '';

        // Calculate insights & get static HTML
        const insightsData = calculateInsightsData(filteredRecords, allRecords);
        const staticHtml = generateStaticInsightsHTML(insightsData);
        const tableHtml = renderStaticTable(filteredRecords);

        // Page variables
        const seo = buildPageSeo(targetAirport, targetAirline, insightsData, pageLatestYear, pageLatestMonth);
        let pageTitle = seo.title;
        let pageDesc = seo.description;
        let pageHeading = seo.heading;
        let breadcrumbHtml = '';

        if (targetAirport) {
            breadcrumbHtml = `
            <div class="breadcrumb" style="margin-bottom: var(--space-4); font-size: 0.875rem; color: var(--color-text-secondary);">
                <a href="/" style="color: var(--color-primary); text-decoration: none;">首頁</a> &gt;
                <span style="color: var(--color-text-primary); font-weight: 500;">${targetAirport}</span>
            </div>`;
        } else if (targetAirline) {
            const fullName = airlineFullNames[targetAirline] || targetAirline;
            breadcrumbHtml = `
            <div class="breadcrumb" style="margin-bottom: var(--space-4); font-size: 0.875rem; color: var(--color-text-secondary);">
                <a href="/" style="color: var(--color-primary); text-decoration: none;">首頁</a> &gt;
                <span style="color: var(--color-text-primary); font-weight: 500;">${fullName}</span>
            </div>`;
        }

        let html = templateHtml;

        const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
        const insightsAdHtml = generateAdSlotHTML('insights', ADSENSE_CLIENT, ADSENSE_SLOT_INSIGHTS, isProd);
        const tableAdHtml = generateAdSlotHTML('table', ADSENSE_CLIENT, ADSENSE_SLOT_TABLE, isProd);

        html = html.replace('<!-- ADSENSE_INSIGHTS_SLOT -->', insightsAdHtml);
        html = html.replace('<!-- ADSENSE_TABLE_SLOT -->', tableAdHtml);
        html = html.replace('<!-- ROUTE_RANKINGS_SECTION -->', routeSectionHtml);
        html = html.replace('<!-- HOLIDAY_ENTRY -->', holidayEntryHtml);

        // Inject page metadata
        html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
        html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${pageDesc}">`);
        html = html.replace(/<h1 class="logo-text">.*?<\/h1>/, `<h1 class="logo-text">${pageHeading}</h1>`);

        // Inject Canonical URL & OG Meta Tags
        const canonicalUrl = `${SITE_URL}${relativeUrlPath}`;
        const ogTags = `
    <link rel="canonical" href="${canonicalUrl}">
    <meta name="robots" content="index,follow,max-snippet:180,max-image-preview:large">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${pageDesc}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="${SITE_URL}/og-card.png">
    <meta property="og:site_name" content="台灣航空載客率查詢">
    <meta property="og:locale" content="zh_TW">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${pageTitle}">
    <meta name="twitter:description" content="${pageDesc}">`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        // Inject dynamic JSON-LD schemas
        const jsonLdHtml = generateJsonLd(targetAirport, targetAirline, pageTitle, pageDesc, canonicalUrl, insightsData, pageLatestYear, pageLatestMonth, allRecords, { data: routeData, subject: routeSubject });
        html = html.replace('</head>', `${jsonLdHtml}\n</head>`);

        // Inject breadcrumbs if not homepage
        if (breadcrumbHtml) {
            html = html.replace(
                /(<main class="main">[\s\S]*?<div class="container">)/,
                `$1\n${breadcrumbHtml}`
            );
        }

        // Replace human-readable search summary before data-heavy sections.
        html = html.replace(
            /(<section class="search-summary" id="search-summary" aria-labelledby="search-summary-title">)[\s\S]*?(<\/section>)/,
            `$1
                <h2 id="search-summary-title">${seo.summaryTitle}</h2>
                <p>${seo.summaryText}</p>
            $2`
        );

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

        // Keep the numeric destination ranking out of search snippets on the homepage.
        // The heading and human-readable search summary remain indexable.
        if (!targetAirport && !targetAirline) {
            html = html.replace(
                '<div class="top-routes-list" id="top-routes-list">',
                '<div class="top-routes-list" id="top-routes-list" data-nosnippet>'
            );
        }

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
        const latestDateStr = `${pageLatestYear}-${String(pageLatestMonth).padStart(2, '0')}-01`;
        html = html.replace(/<dd id="dq-update-time">[\s\S]*?<\/dd>/, `<dd id="dq-update-time"><time datetime="${latestDateStr}">${pageLatestYear}年${pageLatestMonth}月</time></dd>`);

        // Update header update time badge (E-E-A-T)
        html = html.replace(/<span id="header-update-time">.*?<\/span>/, `<span id="header-update-time">${pageLatestYear}年${String(pageLatestMonth).padStart(2, '0')}月</span>`);

        // Uniform footer year
        html = html.replace(/<span id="footer-year">.*?<\/span>/g, `<span id="footer-year">${new Date().getFullYear()}</span>`);

        // Save output file
        const dir = path.dirname(outputFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputFilePath, html, 'utf8');
        console.log(`Generated page: ${outputFilePath} (Latest Month: ${pageLatestYear}-${pageLatestMonth})`);
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

    // 4b. Collect all insights pages (monthly reports + feature articles) and build /insights/ index
    const now = buildDate;
    const insightsRoot = path.join(__dirname, 'insights');
    for (const slug of fs.readdirSync(insightsRoot)) {
        const file = path.join(insightsRoot, slug, 'index.html');
        if (!fs.existsSync(file)) continue;
        const before = fs.readFileSync(file, 'utf8');
        const after = ensureGa(before);
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            console.log(`Injected GA4 into insights/${slug}/index.html`);
        }
    }
    const insightPages = collectInsightPages(insightsRoot, now);
    fs.writeFileSync(path.join(__dirname, 'insights', 'index.html'), renderInsightsIndex(insightPages), 'utf8');
    console.log(`Generated insights/index.html (${insightPages.length} pages)`);

    // 5. Generate sitemap.xml
    console.log('Generating sitemap.xml...');
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/insights/</loc>
    <lastmod>${insightPages.reduce((m, p) => p.lastmod > m ? p.lastmod : m, '') || now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
${insightPages.map(p => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.path === monthlyReportPath ? '0.8' : '0.6'}</priority>
  </url>
`).join('')}  <url>
    <loc>${SITE_URL}/about/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${SITE_URL}/privacy/</loc>
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
- ${monthlyReport.year} 年 ${monthlyReport.month} 月台灣航空月報: ${SITE_URL}${monthlyReportPath}
- 全部月報與市場洞察列表: ${SITE_URL}/insights/
${holidayPreviews.map(h => `- ${h.title}: ${SITE_URL}${h.path}\n`).join('')}- 桃園國際機場 (TPE): ${SITE_URL}/airport/tpe/
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
