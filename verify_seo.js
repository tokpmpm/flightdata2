/**
 * Automated SEO & AIEO Verification Script
 * Validates the generated HTML files, JSON-LD schemas, datasets, sitemaps, and llms.txt.
 */

const fs = require('fs');
const path = require('path');

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

// 1. Check required files existence
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
    assert(content.includes('/airport/tpe/'), 'sitemap.xml contains TPE airport link');
    assert(content.includes('/airline/cal/'), 'sitemap.xml contains CAL airline link');
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

// 4. Helper to validate HTML schemas and structures
function validateHtmlFile(filePath, isHomepage = false, isAboutPage = false, isInsightsPage = false) {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Missing expected file: ${filePath}`);
        errorCount++;
        return;
    }

    const html = fs.readFileSync(fullPath, 'utf8');
    
    // Canonical link
    assert(html.includes('<link rel="canonical"'), `${filePath} contains canonical link`);

    // Basic Page Title & Meta Description
    assert(html.includes('<title>'), `${filePath} contains title tag`);
    assert(html.includes('<meta name="description"'), `${filePath} contains meta description tag`);

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

    // JSON-LD Scripts count
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">/g);
    assert(jsonLdMatches && jsonLdMatches.length >= 1, `${filePath} contains at least one JSON-LD schema`);

    if (jsonLdMatches) {
        // Parse all JSON-LD blocks
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

        // Flatten graph-based schemas
        let flatSchemas = [];
        schemas.forEach(s => {
            if (s['@graph'] && Array.isArray(s['@graph'])) {
                flatSchemas.push(...s['@graph']);
            } else {
                flatSchemas.push(s);
            }
        });

        // Verify specific schema types
        if (isHomepage) {
            const hasDataCatalog = flatSchemas.some(s => s['@type'] === 'DataCatalog');
            assert(hasDataCatalog, 'Homepage JSON-LD contains DataCatalog');
        } else if (isAboutPage) {
            const hasAboutPage = flatSchemas.some(s => s['@type'] === 'AboutPage');
            assert(hasAboutPage, 'About Page JSON-LD contains AboutPage type');
        } else if (isInsightsPage) {
            const hasArticle = flatSchemas.some(s => s['@type'] === 'Article');
            const hasFAQPage = flatSchemas.some(s => s['@type'] === 'FAQPage');
            const hasBreadcrumbList = flatSchemas.some(s => s['@type'] === 'BreadcrumbList');
            const hasDataset = flatSchemas.some(s => s['@type'] === 'Dataset' || (s['about'] && s['about']['@type'] === 'Dataset'));
            const article = flatSchemas.find(s => s['@type'] === 'Article');
            const faqPage = flatSchemas.find(s => s['@type'] === 'FAQPage');
            const breadcrumbList = flatSchemas.find(s => s['@type'] === 'BreadcrumbList');

            assert(hasArticle, 'Insights page JSON-LD contains Article');
            assert(hasFAQPage, 'Insights page JSON-LD contains FAQPage');
            assert(hasBreadcrumbList, 'Insights page JSON-LD contains BreadcrumbList');
            assert(hasDataset, 'Insights page JSON-LD contains Dataset');
            assert(html.includes('<title>2026 年 1-4 月台灣航空市場洞察與載客率分析 - 外勞芭 AI 招喚工坊</title>'), 'Insights page contains correct updated title');
            assert(article && article.dateModified === '2026-06-11', 'Insights page Article dateModified is 2026-06-11');
            assert(article && article.description.includes('2026 年 1-4 月') && article.description.includes('2025 年同期'), 'Insights page Article description labels 2026 1-4 period and YoY baseline');
            assert(!html.includes('2024-01 至 2026-04') && !html.includes('2024-01/2026-04'), 'Insights page has no stale cumulative-period scope');
            assert(!html.includes('AI Overview'), 'Insights page has no AI Overview label');
            assert(breadcrumbList && breadcrumbList.itemListElement[2] && breadcrumbList.itemListElement[2].name === '2026 年 1-4 月台灣航空市場洞察與載客率分析', 'Insights breadcrumb uses revised report title');

            const sectionIds = Array.from(html.matchAll(/<section id="(q\d+)"/g)).map(match => match[1]);
            const expectedSectionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];
            const uniqueSectionIds = new Set(sectionIds);
            assert(JSON.stringify(sectionIds) === JSON.stringify(expectedSectionIds), 'Insights page has exactly Q1-Q11 sections in order');
            assert(uniqueSectionIds.size === sectionIds.length, 'Insights page has no duplicate question section IDs');
            assert((html.match(/<section id="q6"/g) || []).length === 1, 'Insights page has exactly one Q6 section');

            const routeTableMatch = html.match(/<table class="data-table" id="route-rank-table">([\s\S]*?)<\/table>/);
            const routeRows = routeTableMatch ? (routeTableMatch[1].match(/<tr>/g) || []).length - 1 : 0;
            assert(routeRows === 10, 'Insights page route ranking table has 10 body rows');
            assert(routeTableMatch && !routeTableMatch[1].includes('id="q6"'), 'Insights page Q6 section is not nested inside route table');

            const dataset = article && article.about && article.about['@type'] === 'Dataset' ? article.about : null;
            const q11Answer = faqPage && faqPage.mainEntity && faqPage.mainEntity[10] && faqPage.mainEntity[10].acceptedAnswer.text;
            assert(dataset && dataset.temporalCoverage === '2026-01/2026-04', 'Insights Dataset temporalCoverage is 2026-01/2026-04');
            assert(html.includes('資料來源：交通部民用航空局'), 'Insights page names the requested data source');
            assert(!html.includes('民航統計月報') && !html.includes('115 年 4 月') && !html.includes('115年4月') && !html.includes('官方開放資料列表頁'), 'Insights page does not expose extra source caveats or raw monthly-file wording');
            assert(!html.includes('；站內整合原始檔') && !html.includes('extracted/115年4月.xls'), 'Insights page does not expose local raw-file paths in reader-facing metadata');
            assert(q11Answer && q11Answer.includes('2026-01 至 2026-04') && q11Answer.includes('2025 年同期'), 'Insights Q11 states period and comparison baseline');
            assert(!html.includes('3-5 工作天') && !html.includes('完整度 100%') && !html.includes('資料庫完整度達 100%'), 'Insights page avoids fixed update SLA and 100% completeness claims');
        } else {
            // Airport or Airline Page
            const hasFAQPage = flatSchemas.some(s => s['@type'] === 'FAQPage');
            const hasBreadcrumbList = flatSchemas.some(s => s['@type'] === 'BreadcrumbList');
            const hasDataset = flatSchemas.some(s => s['@type'] === 'Dataset' || (s['about'] && s['about']['@type'] === 'Dataset'));

            assert(hasFAQPage, `${filePath} JSON-LD contains FAQPage`);
            assert(hasBreadcrumbList, `${filePath} JSON-LD contains BreadcrumbList`);
            assert(hasDataset, `${filePath} JSON-LD contains Dataset`);
        }
    }
}

// Validate major pages
validateHtmlFile('index.html', true, false, false);
validateHtmlFile('airport/tpe/index.html', false, false, false);
validateHtmlFile('airline/cal/index.html', false, false, false);
validateHtmlFile('about/index.html', false, true, false);
validateHtmlFile('insights/2026-taiwan-aviation-market-outlook/index.html', false, false, true);

// 5. Check Datasets existence in data/
const datasets = [
    'flight_data_all.csv', 'flight_data_all.json',
    'flight_data_airport-tpe.csv', 'flight_data_airport-tpe.json',
    'flight_data_airline-cal.csv', 'flight_data_airline-cal.json'
];
datasets.forEach(ds => {
    const dsPath = path.join(__dirname, 'data', ds);
    assert(fs.existsSync(dsPath), `Dataset exists: data/${ds}`);
});

console.log('================================================');
if (errorCount > 0) {
    console.error(`❌ SEO/AIEO Verification failed with ${errorCount} error(s).`);
    process.exit(1);
} else {
    console.log('🎉 All SEO/AIEO Verification checks passed successfully!');
    process.exit(0);
}
