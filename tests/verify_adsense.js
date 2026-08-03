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

    // Assertion A: Maximum 2 AdSense slots
    const slotCount = (html.match(/class="adsense-slot/g) || []).length;
    assert(slotCount <= 2, `${filePath} contains <= 2 adsense slots (got ${slotCount})`);

    // Assertion B: Single AdSense script tag
    const scriptCount = (html.match(/pagead2.googlesyndication.com\/pagead\/js\/adsbygoogle.js/g) || []).length;
    assert(scriptCount <= 1, `${filePath} contains <= 1 AdSense script client tag (got ${scriptCount})`);

    // Assertion C: Slots are placed in natural dividers
    // Position 1: After #key-findings and before .top-routes-panel
    const hasPosition1 = html.includes('id="key-findings"') && html.includes('class="top-routes-panel"');
    if (hasPosition1) {
        const parts = html.split('id="key-findings"');
        const afterFindings = parts[1] || '';
        const beforeTopRoutes = afterFindings.split('class="top-routes-panel"')[0] || '';
        assert(beforeTopRoutes.includes('data-ad-position="insights"'), `${filePath} has AdSense slot 1 between #key-findings and .top-routes-panel`);
    }

    // Position 2: After .charts-section and before .table-section
    const hasPosition2 = html.includes('class="charts-section"') && html.includes('class="table-section"');
    if (hasPosition2) {
        const parts = html.split('class="charts-section"');
        const afterCharts = parts[1] || '';
        const beforeTable = afterCharts.split('class="table-section"')[0] || '';
        assert(beforeTable.includes('data-ad-position="table"'), `${filePath} has AdSense slot 2 between .charts-section and .table-section`);
    }

    // Assertion D: Ad slots do not leak inside main data structures (Answers, Canvas, Filters, etc.)
    // Ad slot 1 must not be inside #insights-list
    const insightsListParts = html.split('id="insights-list"');
    if (insightsListParts.length > 1) {
        const insideList = insightsListParts[1].split('</ul>')[0];
        assert(!insideList.includes('adsense-slot'), `${filePath}: Ad slot is NOT nested inside #insights-list`);
    }

    // Assertion E: Footer contains privacy policy link
    assert(html.includes('href="/privacy/"') && html.includes('隱私權政策'), `${filePath} footer contains Privacy Policy link`);

    // Assertion F: Under invalid/stale/placeholder Slot ID configurations, the actual <ins class="adsbygoogle"> must NOT be written
    // (Since we are building locally and the env variables are placeholders from .env.example, they contain "REPLACE_WITH", so no actual <ins> should be rendered)
    assert(!html.includes('class="adsbygoogle"'), `${filePath} does not render actual <ins class="adsbygoogle"> under invalid/placeholder Slot IDs`);
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

console.log('================================================');
if (errorCount > 0) {
    console.error(`❌ AdSense & Privacy Verification failed with ${errorCount} error(s).`);
    process.exit(1);
} else {
    console.log('🎉 All AdSense & Privacy Verification checks passed successfully!');
    process.exit(0);
}
