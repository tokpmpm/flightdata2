/**
 * Automated AdSense & Privacy Policy Verification Suite
 */

const fs = require('fs');
const path = require('path');

console.log('=== Starting AdSense & Privacy Policy Automated Verification ===');

let errorCount = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ [ERROR] ${message}`);
        errorCount++;
    } else {
        console.log(`✅ [OK] ${message}`);
    }
}

const airportCodes = ['tpe', 'khh', 'tsa', 'rmq', 'tnn', 'hun'];
const airlineCodes = ['cal', 'eva', 'starlux', 'tiger'];

// Load environment variables locally
if (fs.existsSync(path.join(__dirname, '..', '.env'))) {
    const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
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

const ADSENSE_SLOT_INSIGHTS = process.env.ADSENSE_SLOT_INSIGHTS || 'REPLACE_WITH_INSIGHTS_SLOT_ID';
const ADSENSE_SLOT_TABLE = process.env.ADSENSE_SLOT_TABLE || 'REPLACE_WITH_TABLE_SLOT_ID';

function isValidAdSlot(slotId) {
    if (!slotId) return false;
    const str = String(slotId).trim();
    if (str === '') return false;
    if (str.includes('REPLACE_WITH')) return false;
    return /^\d+$/.test(str);
}

const isInsightsValid = isValidAdSlot(ADSENSE_SLOT_INSIGHTS);
const isTableValid = isValidAdSlot(ADSENSE_SLOT_TABLE);
const slotsAreValid = isInsightsValid && isTableValid;

// detect environment like prerender.js
const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

console.log(`[Config Check] Insights Slot ID: "${ADSENSE_SLOT_INSIGHTS}" (Valid: ${isInsightsValid})`);
console.log(`[Config Check] Table Slot ID: "${ADSENSE_SLOT_TABLE}" (Valid: ${isTableValid})`);
console.log(`[Config Check] Environment isProd: ${isProd}`);

// 1. Verify ads.txt existence and content
const adsTxtPath = path.join(__dirname, '..', 'ads.txt');
assert(fs.existsSync(adsTxtPath), 'ads.txt exists at root');
if (fs.existsSync(adsTxtPath)) {
    const content = fs.readFileSync(adsTxtPath, 'utf8').trim();
    const expected = 'google.com, pub-9747455231872729, DIRECT, f08c47fec0942fa0';
    assert(content === expected, `ads.txt content matches exactly: "${content}"`);
}

// 2. Validate Privacy policy page existence and attributes
const privacyPath = path.join(__dirname, '..', 'privacy', 'index.html');
assert(fs.existsSync(privacyPath), 'privacy/index.html exists');
if (fs.existsSync(privacyPath)) {
    const html = fs.readFileSync(privacyPath, 'utf8');
    assert(html.includes('<title>隱私權政策 | 台灣航空載客率數據分析</title>'), 'Privacy page has correct title');
    assert(html.includes('<meta name="robots" content="index,follow">'), 'Privacy page permits indexing (index,follow)');
    assert(html.includes('<link rel="canonical" href="https://flightdata2.meshthings.com/privacy/">'), 'Privacy page has canonical link');
    assert(!html.includes('adsense-slot'), 'Privacy page has no AdSense slots');
}

// Helper to validate data pages (home, airports, airlines)
function validateDataPageAdSlot(filePath) {
    const fullPath = path.join(__dirname, '..', filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Expected file not found: ${filePath}`);
        errorCount++;
        return;
    }

    const html = fs.readFileSync(fullPath, 'utf8');

    // Assertion A: Single AdSense script tag
    const scriptCount = (html.match(/pagead2.googlesyndication.com\/pagead\/js\/adsbygoogle.js/g) || []).length;
    assert(scriptCount === 1, `${filePath} contains exactly 1 AdSense script client tag (got ${scriptCount})`);

    // Assertion B: Natural dividers check
    const hasPosition1 = html.includes('id="key-findings"') && html.includes('class="top-routes-panel"');
    assert(hasPosition1, `${filePath} contains insights natural dividers`);
    if (hasPosition1) {
        const parts = html.split('id="key-findings"');
        const afterFindings = parts[1] || '';
        const beforeTopRoutes = afterFindings.split('class="top-routes-panel"')[0] || '';
        // In prod without valid ID, it will be a comment, not an active element
        if (slotsAreValid || !isProd) {
            assert(beforeTopRoutes.includes('data-ad-position="insights"'), `${filePath} has AdSense slot 1 between #key-findings and .top-routes-panel`);
        } else {
            assert(beforeTopRoutes.includes('AdSense slot placeholder for insights'), `${filePath} has Insights ad placeholder comment`);
        }
    }

    const hasPosition2 = html.includes('class="charts-section"') && html.includes('class="table-section"');
    assert(hasPosition2, `${filePath} contains table natural dividers`);
    if (hasPosition2) {
        const parts = html.split('class="charts-section"');
        const afterCharts = parts[1] || '';
        const beforeTable = afterCharts.split('class="table-section"')[0] || '';
        if (slotsAreValid || !isProd) {
            assert(beforeTable.includes('data-ad-position="table"'), `${filePath} has AdSense slot 2 between .charts-section and .table-section`);
        } else {
            assert(beforeTable.includes('AdSense slot placeholder for table'), `${filePath} has Table ad placeholder comment`);
        }
    }

    // Assertion C: Ad slots do not leak inside main data structures (Answers, Canvas, Filters, etc.)
    const insightsListParts = html.split('id="insights-list"');
    if (insightsListParts.length > 1) {
        const insideList = insightsListParts[1].split('</ul>')[0];
        assert(!insideList.includes('adsense-slot'), `${filePath}: Ad slot is NOT nested inside #insights-list`);
    }

    // Check chart elements to make sure adsense is not inside
    const chartCardParts = html.split('class="chart-card"');
    if (chartCardParts.length > 1) {
        for (let i = 1; i < chartCardParts.length; i++) {
            const insideChart = chartCardParts[i].split('</div>')[0];
            assert(!insideChart.includes('adsense-slot'), `${filePath}: Ad slot is NOT nested inside chart-card [${i}]`);
        }
    }

    // Check table elements to make sure adsense is not inside
    const tableParts = html.split('<table');
    if (tableParts.length > 1) {
        for (let i = 1; i < tableParts.length; i++) {
            const insideTable = tableParts[i].split('</table>')[0];
            assert(!insideTable.includes('adsense-slot'), `${filePath}: Ad slot is NOT nested inside table [${i}]`);
        }
    }

    // Assertion D: Footer contains privacy policy link
    assert(html.includes('href="/privacy/"') && html.includes('隱私權政策'), `${filePath} footer contains Privacy Policy link`);

    // Assertion E: Dynamic environment testing
    if (slotsAreValid) {
        // Production Valid ID branch
        const slotCount = (html.match(/class="[\w-\s]*adsense-slot[\w-\s]*/g) || []).length;
        const insCount = (html.match(/class="adsbygoogle"/g) || []).length;
        const adSlotAttrCount = (html.match(/data-ad-slot=/g) || []).length;
        
        assert(slotCount === 2, `${filePath} contains exactly 2 .adsense-slot (got ${slotCount})`);
        assert(insCount === 2, `${filePath} contains exactly 2 ins.adsbygoogle (got ${insCount})`);
        assert(adSlotAttrCount === 2, `${filePath} contains exactly 2 data-ad-slot attributes (got ${adSlotAttrCount})`);

        assert(html.includes('data-ad-position="insights"') && html.includes('data-ad-position="table"'), `${filePath} has correct ad positions`);
        assert(!html.includes('REPLACE_WITH'), `${filePath} does not contain REPLACE_WITH`);
        assert(!html.includes('廣告預覽'), `${filePath} does not contain "廣告預覽"`);
        assert(!html.includes('無效 Slot ID'), `${filePath} does not contain "無效 Slot ID"`);

        // Verify data-ad-slots are valid numbers and are different
        const slotsFound = [];
        const regex = /data-ad-slot="([^"]+)"/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            slotsFound.push(match[1]);
        }
        assert(slotsFound.length === 2, `${filePath} found 2 ad-slot values`);
        if (slotsFound.length === 2) {
            assert(/^\d+$/.test(slotsFound[0]), `${filePath} slot 1 "${slotsFound[0]}" is pure digits`);
            assert(/^\d+$/.test(slotsFound[1]), `${filePath} slot 2 "${slotsFound[1]}" is pure digits`);
            assert(slotsFound[0] !== slotsFound[1], `${filePath} slots "${slotsFound[0]}" and "${slotsFound[1]}" are different`);
        }
    } else {
        // Invalid Slot ID branch (Development / Fallback Prod)
        const insCount = (html.match(/class="adsbygoogle"/g) || []).length;
        assert(insCount === 0, `${filePath} contains 0 ins.adsbygoogle (got ${insCount})`);
        assert(!html.includes('data-ad-slot="REPLACE_WITH'), `${filePath} does not render REPLACE_WITH in data-ad-slot`);

        if (isProd) {
            // Production Fallback branch
            const slotCount = (html.match(/class="[\w-\s]*adsense-slot[\w-\s]*/g) || []).length;
            assert(slotCount === 0, `${filePath} contains 0 .adsense-slot in Prod fallback (got ${slotCount})`);
            assert(!html.includes('廣告預覽'), `${filePath} does not contain "廣告預覽" in Prod fallback`);
            assert(!html.includes('adsense-slot--preview'), `${filePath} does not contain preview css class in Prod fallback`);
        } else {
            // Development Preview branch
            const slotCount = (html.match(/class="[\w-\s]*adsense-slot[\w-\s]*/g) || []).length;
            assert(slotCount === 2, `${filePath} contains exactly 2 .adsense-slot in Dev (got ${slotCount})`);
            assert(html.includes('廣告預覽'), `${filePath} contains "廣告預覽" in Dev`);
            assert(html.includes('adsense-slot--preview'), `${filePath} contains preview css class in Dev`);
        }
    }
}

// 3. Run validations on Homepage
console.log('--- Validating Homepage Ads & Privacy Link ---');
validateDataPageAdSlot('index.html');

// 4. Run validations on Airport Pages
console.log('--- Validating Airport Pages Ads & Privacy Link ---');
airportCodes.forEach(code => {
    validateDataPageAdSlot(`airport/${code}/index.html`);
});

// 5. Run validations on Airline Pages
console.log('--- Validating Airline Pages Ads & Privacy Link ---');
airlineCodes.forEach(code => {
    validateDataPageAdSlot(`airline/${code}/index.html`);
});

// 6. Validate About Page does not contain Ad slots but contains privacy link
console.log('--- Validating About Page ---');
const aboutPath = path.join(__dirname, '..', 'about', 'index.html');
if (fs.existsSync(aboutPath)) {
    const html = fs.readFileSync(aboutPath, 'utf8');
    assert(!html.includes('adsense-slot'), 'About page does not contain AdSense slots');
    assert(html.includes('href="/privacy/"') && html.includes('隱私權政策'), 'About page footer contains Privacy Policy link');
}

// 7. Validate Insights Page
console.log('--- Validating Insights Page ---');
const insightsPath = path.join(__dirname, '..', 'insights', '2026-taiwan-aviation-market-outlook', 'index.html');
if (fs.existsSync(insightsPath)) {
    const html = fs.readFileSync(insightsPath, 'utf8');
    assert(!html.includes('adsense-slot'), 'Insights page does not contain AdSense slots');
    assert(html.includes('href="/privacy/"') && html.includes('隱私權政策'), 'Insights page footer contains Privacy Policy link');
}

// 8. Validate sitemap.xml contains /privacy/
console.log('--- Validating Sitemap ---');
const sitemapPath = path.join(__dirname, '..', 'sitemap.xml');
assert(fs.existsSync(sitemapPath), 'sitemap.xml exists');
if (fs.existsSync(sitemapPath)) {
    const content = fs.readFileSync(sitemapPath, 'utf8');
    assert(content.includes('<loc>https://flightdata2.meshthings.com/privacy/</loc>'), 'Sitemap contains privacy policy URL');
}

console.log('================================================');
if (errorCount > 0) {
    console.error(`❌ AdSense & Privacy Verification failed with ${errorCount} error(s).`);
    process.exit(1);
} else {
    console.log('🎉 All AdSense & Privacy Verification checks passed successfully!');
    process.exit(0);
}
