/**
 * Automated SEO & AIEO Verification Script
 * Validates generated HTML files, JSON-LD schemas, datasets, sitemaps, and llms.txt.
 */

const fs = require('fs');
const path = require('path');
const { flightData } = require('./data/flight_data_new.js');

console.log('=== Starting SEO/AIEO Automated Verification ===');

let errorCount = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ [ERROR] ${message}`);
        errorCount++;
    } else {
        console.log(`✅ [OK] ${message}`);
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

// Compute page max year-month from flightData
const allData = flightData['所有'] || {};
function getPageMaxYM(targetAirport, targetAirline) {
    let maxYM = 0;
    for (const ap in allData) {
        if (targetAirport && ap !== targetAirport) continue;
        for (const dest in allData[ap]) {
            for (const al in allData[ap][dest]) {
                if (targetAirline && al !== targetAirline) continue;
                const recs = allData[ap][dest][al];
                recs.forEach(r => {
                    const ym = r.year * 100 + r.month;
                    if (ym > maxYM) maxYM = ym;
                });
            }
        }
    }
    const year = Math.floor(maxYM / 100);
    const month = maxYM % 100;
    return { year, month, ymKey: maxYM, ymStr: `${year}-${String(month).padStart(2, '0')}` };
}

// 1. Check required root files
const requiredRootFiles = ['index.html', 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt', 'about/index.html'];
requiredRootFiles.forEach(file => {
    const fullPath = path.join(__dirname, file);
    assert(fs.existsSync(fullPath), `File exists: ${file}`);
});

// 2. Validate Sitemap
const sitemapPath = path.join(__dirname, 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
    const content = fs.readFileSync(sitemapPath, 'utf8');
    assert(content.includes('<urlset'), 'sitemap.xml contains urlset tag');
    assert(content.includes('<loc>'), 'sitemap.xml contains loc tags');
    for (const ap in airportCodes) {
        const code = airportCodes[ap];
        assert(content.includes(`/airport/${code}/`), `sitemap.xml contains ${ap} (${code}) link`);
    }
    for (const al in airlineSlugCodes) {
        const code = airlineSlugCodes[al];
        assert(content.includes(`/airline/${code}/`), `sitemap.xml contains ${al} (${code}) link`);
    }
    assert(content.includes('/about/'), 'sitemap.xml contains About page link');
}

// 3. Validate llms.txt
const llmsPath = path.join(__dirname, 'llms.txt');
if (fs.existsSync(llmsPath)) {
    const content = fs.readFileSync(llmsPath, 'utf8');
    assert(content.includes('# MeshThings FlightData'), 'llms.txt contains proper title');
    assert(content.includes('/airport/tpe/'), 'llms.txt contains TPE airport link');
    assert(content.includes('/airline/cal/'), 'llms.txt contains CAL airline link');
    assert(content.includes('/data/flight_data_all.csv'), 'llms.txt contains dataset link');
}

// 4. Validate all public pages
function validateHtmlFile(filePath, isHomepage = false, isAboutPage = false, isInsightsPage = false, targetAirport = null, targetAirline = null) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Missing expected file: ${filePath}`);
        errorCount++;
        return;
    }

    const html = fs.readFileSync(fullPath, 'utf8');

    // 1 H1 Tag Check
    const h1Matches = html.match(/<h1[\s>]/g) || [];
    assert(h1Matches.length === 1, `${filePath} contains exactly 1 H1 tag (got ${h1Matches.length})`);

    // Title Tag
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    assert(titleMatch && titleMatch[1].trim().length > 0, `${filePath} contains non-empty title tag`);

    // Meta Description
    const descMatch = html.match(/<meta name="description" content="(.*?)">/);
    assert(descMatch && descMatch[1].trim().length > 0, `${filePath} contains non-empty meta description tag`);

    // Canonical link
    assert(html.includes('<link rel="canonical"'), `${filePath} contains canonical link`);

    // Open Graph
    assert(html.includes('property="og:title"'), `${filePath} contains og:title`);
    assert(html.includes('property="og:description"'), `${filePath} contains og:description`);
    assert(html.includes('property="og:type"'), `${filePath} contains og:type`);
    assert(html.includes('property="og:url"'), `${filePath} contains og:url`);
    assert(html.includes('property="og:image"'), `${filePath} contains og:image`);

    // Twitter Card
    assert(html.includes('name="twitter:card"'), `${filePath} contains twitter:card`);
    assert(html.includes('name="twitter:title"'), `${filePath} contains twitter:title`);
    assert(html.includes('name="twitter:description"'), `${filePath} contains twitter:description`);

    if (!isAboutPage && !isInsightsPage) {
        assert(html.includes('<meta name="robots" content="index,follow,max-snippet:180,max-image-preview:large">'), `${filePath} contains snippet control robots meta`);
        assert(html.includes('class="search-summary"'), `${filePath} contains visible search summary`);
        assert(html.includes('data-nosnippet'), `${filePath} excludes data table from search snippets`);
    }

    // Smart Insights & Key Findings container
    if (!isAboutPage) {
        assert(html.includes('id="key-findings"') || html.includes('class="hero-tldr"') || html.includes('class="tldr"'), `${filePath} contains key-findings/tldr section`);
        assert(html.includes('itemprop="mainEntity"') || html.includes('itemProp="mainEntity"'), `${filePath} contains Microdata itemprop="mainEntity"`);
        assert(html.includes('itemscope itemtype="https://schema.org/Answer"') || html.includes('itemScope itemType="https://schema.org/Answer"'), `${filePath} contains Microdata Answer scope`);
        assert(html.includes('itemprop="text"') || html.includes('itemProp="text"'), `${filePath} contains Microdata text scope`);

        // Data Quality Indicator
        if (!isInsightsPage) {
            assert(html.includes('id="dq-title"'), `${filePath} contains Data Quality Indicator`);
            assert(html.includes('id="dq-completeness"'), `${filePath} contains completeness data`);
            assert(html.includes('id="dq-update-time"'), `${filePath} contains update time data`);
        }

        // Download Links
        if (!isInsightsPage) {
            assert(html.includes('id="download-links"'), `${filePath} contains download links section`);
        }
    }

    // JSON-LD Scripts count & Parsing
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">/g);
    assert(jsonLdMatches && jsonLdMatches.length >= 1, `${filePath} contains at least one JSON-LD schema`);

    if (jsonLdMatches) {
        const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
        let match;
        let schemas = [];

        while ((match = scriptRegex.exec(html)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                schemas.push(parsed);
            } catch (e) {
                assert(false, `Failed to parse JSON-LD in ${filePath}: ${e.message}`);
            }
        }

        let flatSchemas = [];
        schemas.forEach(s => {
            if (s['@graph'] && Array.isArray(s['@graph'])) {
                flatSchemas.push(...s['@graph']);
            } else {
                flatSchemas.push(s);
            }
        });

        if (isHomepage) {
            const hasDataCatalog = flatSchemas.some(s => s['@type'] === 'DataCatalog');
            const hasWebSite = flatSchemas.some(s => s['@type'] === 'WebSite');
            assert(hasDataCatalog, 'Homepage JSON-LD contains DataCatalog');
            assert(hasWebSite, 'Homepage JSON-LD contains WebSite');

            // Check DataCatalog nested datasets
            const catalog = flatSchemas.find(s => s['@type'] === 'DataCatalog');
            assert(catalog && Array.isArray(catalog.dataset), 'Homepage has DataCatalog with datasets');
            if (catalog && catalog.dataset) {
                catalog.dataset.forEach(ds => {
                    assert(ds.description && ds.description.length >= 50, `DataCatalog nested Dataset "${ds.name}" description >= 50 chars`);
                    assert(ds.license === 'https://data.gov.tw/license', `DataCatalog nested Dataset "${ds.name}" has correct license https://data.gov.tw/license`);
                    assert(ds.temporalCoverage, `DataCatalog nested Dataset "${ds.name}" has temporalCoverage`);
                });
            }
        } else if (isAboutPage) {
            const hasAboutPage = flatSchemas.some(s => s['@type'] === 'AboutPage');
            assert(hasAboutPage, 'About Page JSON-LD contains AboutPage type');
        } else if (isInsightsPage) {
            const hasArticle = flatSchemas.some(s => s['@type'] === 'Article');
            const hasFAQPage = flatSchemas.some(s => s['@type'] === 'FAQPage');
            const hasBreadcrumbList = flatSchemas.some(s => s['@type'] === 'BreadcrumbList');
            assert(hasArticle, 'Insights page JSON-LD contains Article');
            assert(hasFAQPage, 'Insights page JSON-LD contains FAQPage');
            assert(hasBreadcrumbList, 'Insights page JSON-LD contains BreadcrumbList');
        } else {
            // Airport or Airline Page
            const hasFAQPage = flatSchemas.some(s => s['@type'] === 'FAQPage');
            const hasBreadcrumbList = flatSchemas.some(s => s['@type'] === 'BreadcrumbList');
            const hasDataset = flatSchemas.some(s => s['@type'] === 'Dataset' || (s['about'] && s['about']['@type'] === 'Dataset'));

            assert(hasFAQPage, `${filePath} JSON-LD contains FAQPage`);
            assert(hasBreadcrumbList, `${filePath} JSON-LD contains BreadcrumbList`);
            assert(hasDataset, `${filePath} JSON-LD contains Dataset`);
        }

        // Check Dataset schema license and creator
        const datasets = flatSchemas.filter(s => s['@type'] === 'Dataset' || (s['about'] && s['about']['@type'] === 'Dataset'));
        datasets.forEach(s => {
            const ds = s['@type'] === 'Dataset' ? s : s['about'];
            assert(ds.description && ds.description.length >= 50, `${filePath} Dataset "${ds.name}" description >= 50 chars`);
            assert(ds.license === 'https://data.gov.tw/license', `${filePath} Dataset "${ds.name}" license is https://data.gov.tw/license`);
            assert(ds.creator && ds.creator.name === '交通部民用航空局', `${filePath} Dataset "${ds.name}" has creator "交通部民用航空局"`);
        });
    }

    // Page-specific Latest Month Verification
    if (!isAboutPage && !isInsightsPage) {
        const actualMax = getPageMaxYM(targetAirport, targetAirline);

        // Extract stated date from header-update-time
        const headerTimeMatch = html.match(/<span id="header-update-time">(\d{4})年(\d{2})月<\/span>/);
        if (headerTimeMatch) {
            const statedYM = parseInt(headerTimeMatch[1]) * 100 + parseInt(headerTimeMatch[2]);
            assert(statedYM <= actualMax.ymKey, `${filePath} header update month (${headerTimeMatch[1]}-${headerTimeMatch[2]}) <= actual latest (${actualMax.year}-${actualMax.month})`);
            assert(statedYM === actualMax.ymKey, `${filePath} header update month matches actual latest month exactly (${actualMax.year}-${actualMax.month})`);
        }

        // Extract stated date from dq-update-time
        const dqTimeMatch = html.match(/<dd id="dq-update-time"><time datetime="(\d{4}-\d{2})-\d{2}">(\d{4})年(\d{1,2})月<\/time><\/dd>/);
        if (dqTimeMatch) {
            const statedYM = parseInt(dqTimeMatch[2]) * 100 + parseInt(dqTimeMatch[3]);
            assert(statedYM <= actualMax.ymKey, `${filePath} dq update month (${dqTimeMatch[2]}-${dqTimeMatch[3]}) <= actual latest (${actualMax.year}-${actualMax.month})`);
            assert(statedYM === actualMax.ymKey, `${filePath} dq update month matches actual latest month exactly (${actualMax.year}-${actualMax.month})`);
        }

        // Check temporalCoverage in Dataset schema
        const temporalMatch = html.match(/"temporalCoverage":\s*"(\d{4}-\d{2})-01\/(\d{4}-\d{2})-01"/);
        if (temporalMatch) {
            const endYM = temporalMatch[2];
            assert(endYM === actualMax.ymStr, `${filePath} Dataset temporalCoverage end date (${endYM}) matches actual latest (${actualMax.ymStr})`);
        }

        // Check Download Dataset file existence
        let fileCode = 'all';
        if (targetAirport) {
            fileCode = `airport-${airportCodes[targetAirport]}`;
        } else if (targetAirline) {
            fileCode = `airline-${airlineSlugCodes[targetAirline]}`;
        }
        const csvPath = path.join(__dirname, 'data', `flight_data_${fileCode}.csv`);
        const jsonPath = path.join(__dirname, 'data', `flight_data_${fileCode}.json`);
        assert(fs.existsSync(csvPath), `${filePath} download CSV file exists: data/flight_data_${fileCode}.csv`);
        assert(fs.existsSync(jsonPath), `${filePath} download JSON file exists: data/flight_data_${fileCode}.json`);
    }
}

// Run validation across all generated public pages
console.log('--- Validating Homepage ---');
validateHtmlFile('index.html', true, false, false, null, null);

console.log('--- Validating Airport Pages ---');
for (const ap in airportCodes) {
    const code = airportCodes[ap];
    validateHtmlFile(`airport/${code}/index.html`, false, false, false, ap, null);
}

console.log('--- Validating Airline Pages ---');
for (const al in airlineSlugCodes) {
    const code = airlineSlugCodes[al];
    validateHtmlFile(`airline/${code}/index.html`, false, false, false, null, al);
}

console.log('--- Validating About & Insights Pages ---');
validateHtmlFile('about/index.html', false, true, false);
validateHtmlFile('insights/2026-taiwan-aviation-market-outlook/index.html', false, false, true);

console.log('================================================');
if (errorCount > 0) {
    console.error(`❌ SEO/AIEO Verification failed with ${errorCount} error(s).`);
    process.exit(1);
} else {
    console.log('🎉 All SEO/AIEO Verification checks passed successfully!');
    process.exit(0);
}
