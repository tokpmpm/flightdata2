const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3034;
const BASE_URL = `http://localhost:${PORT}`;
const REPORT_PATH = path.join(__dirname, 'ga4_qa_report.json');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

function getBrowserExecutablePath() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const candidates = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) {
            return c;
        }
    }
    throw new Error('No valid browser executable found. Please set PUPPETEER_EXECUTABLE_PATH.');
}

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    let filePath = path.join(__dirname, '..', urlPath);

    if (urlPath === '/' || urlPath === '') {
        filePath = path.join(__dirname, '..', 'index.html');
    } else if (urlPath.endsWith('/')) {
        filePath = path.join(__dirname, '..', urlPath, 'index.html');
    }

    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.csv') contentType = 'text/csv';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

async function runGA4Tests() {
    console.log('=== Starting GA4 Local Automated Verification Suite (T00 - T21) ===');

    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`GA4 Test Server listening on ${BASE_URL}`);

    const browserPath = getBrowserExecutablePath();
    console.log(`Using browser binary: ${browserPath}`);

    const browser = await puppeteer.launch({
        executablePath: browserPath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const testResults = [];
    const consoleErrorsGlobal = [];
    const consoleWarningsGlobal = [];
    let blockedGARequestsCount = 0;
    let hasFatalError = false;

    async function setupPage(viewport = { width: 1280, height: 720 }) {
        const page = await browser.newPage();
        await page.setViewport(viewport);

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const u = req.url();
            if (
                u.includes('googletagmanager.com') ||
                u.includes('google-analytics.com') ||
                u.includes('analytics.google.com') ||
                u.includes('doubleclick.net')
            ) {
                blockedGARequestsCount++;
                req.abort().catch(() => {});
            } else if (!u.startsWith('http://localhost:3034') && !u.startsWith('http://127.0.0.1')) {
                if (u.includes('chart.umd.min.js') || u.includes('chart')) {
                    req.respond({
                        status: 200,
                        contentType: 'application/javascript',
                        body: 'window.Chart = function() { this.destroy = function(){}; this.resize = function(){}; };'
                    }).catch(() => {});
                } else {
                    req.abort().catch(() => {});
                }
            } else {
                req.continue().catch(() => {});
            }
        });

        page.on('console', (msg) => {
            const text = msg.text();
            const type = msg.type();
            const isExternal =
                text.includes('chrome-extension') ||
                text.includes('Google Fonts') ||
                text.includes('favicon') ||
                text.includes('Chart.js');
            if (!isExternal) {
                if (type === 'error') consoleErrorsGlobal.push({ text });
                if (type === 'warning' || type === 'warn') consoleWarningsGlobal.push({ text });
            }
        });

        page.on('pageerror', (err) => {
            console.log(`[PAGE UNCAUGHT ERROR] ${err.message}`);
            consoleErrorsGlobal.push({ text: err.message });
        });

        return page;
    }

    async function installGA4Stub(page) {
        await page.evaluate(() => {
            window.__ga4TestCalls = [];
            window.gtag = (...args) => {
                window.__ga4TestCalls.push(args);
            };
        });
    }

    async function waitForAppReady(page) {
        await page.waitForFunction(
            () => {
                const airportSel = document.getElementById('airport-select');
                const destSel = document.getElementById('destination-select');
                const applyBtn = document.getElementById('apply-filters');
                const resetBtn = document.getElementById('reset-filters');
                const shareBtn = document.getElementById('share-filters');
                const state = typeof AppState !== 'undefined' ? AppState : window.AppState;
                return (
                    (document.readyState === 'interactive' || document.readyState === 'complete') &&
                    airportSel &&
                    airportSel.options &&
                    airportSel.options.length > 1 &&
                    destSel &&
                    applyBtn &&
                    resetBtn &&
                    shareBtn &&
                    state &&
                    state.rawData &&
                    state.rawData.length > 0
                );
            },
            { timeout: 10000 }
        );
    }

    async function recordResult(id, name, status, expected, actual, evidence = {}) {
        testResults.push({ id, name, status, expected, actual, evidence });
        console.log(`[${status}] ${id}: ${name} | Expected: ${expected} | Actual: ${actual}`);
        if (status === 'FAIL') {
            const ssPath = path.join(SCREENSHOT_DIR, `ga4_${id}_failure.png`);
            try {
                const activePages = await browser.pages();
                if (activePages.length > 0) {
                    await activePages[activePages.length - 1].screenshot({ path: ssPath });
                    console.log(`   Failure screenshot saved: ${ssPath}`);
                }
            } catch (e) {
                console.error(`   Failed to capture screenshot for ${id}:`, e.message);
            }
        }
    }

    try {
        // T00: 首頁初始載入
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);

            const dataLayerEvents = await page.evaluate(() => {
                if (!window.dataLayer) return [];
                return window.dataLayer.map((entry) => {
                    const arr = Array.from(entry);
                    return { type: arr[0], name: arr[1], params: arr[2] };
                });
            });

            await installGA4Stub(page);

            const customEvents = dataLayerEvents.filter(
                (e) =>
                    e.type === 'event' &&
                    ['search', 'no_search_results', 'filter_reset', 'share'].includes(e.name)
            );

            const pass = customEvents.length === 0;
            await recordResult(
                'T00',
                '首頁初始載入無行為事件',
                pass ? 'PASS' : 'FAIL',
                '0 custom behavior events on initial load',
                `${customEvents.length} custom events`,
                { dataLayerEvents }
            );
            await page.close();
        }

        // T01: trackGA4 參數清理
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            const testResult = await page.evaluate(() => {
                const original = {
                    valid_string: 'abc',
                    valid_number: 12,
                    zero_value: 0,
                    false_value: false,
                    remove_undefined: undefined,
                    remove_null: null,
                    remove_nan: NaN,
                    remove_infinity: Infinity,
                    remove_negative_infinity: -Infinity,
                    remove_object: { x: 1 },
                    remove_array: [1, 2],
                    remove_dom: document.body,
                    remove_function: function () {}
                };

                trackGA4('test_event', original);
                trackGA4('', { a: 1 });
                trackGA4(null, { a: 1 });

                const calls = window.__ga4TestCalls;
                const testEventCalls = calls.filter((c) => Array.from(c)[1] === 'test_event');
                const lastCallParams = testEventCalls.length > 0 ? Array.from(testEventCalls[0])[2] : {};

                const originalUnmutated =
                    original.valid_string === 'abc' &&
                    original.valid_number === 12 &&
                    original.remove_undefined === undefined;

                return {
                    testEventCount: testEventCalls.length,
                    totalCallsCount: calls.length,
                    params: lastCallParams,
                    originalUnmutated
                };
            });

            const p = testResult.params;
            const validCleaning =
                testResult.testEventCount === 1 &&
                testResult.totalCallsCount === 1 &&
                p.valid_string === 'abc' &&
                p.valid_number === 12 &&
                p.zero_value === 0 &&
                p.false_value === false &&
                !('remove_undefined' in p) &&
                !('remove_null' in p) &&
                !('remove_nan' in p) &&
                !('remove_infinity' in p) &&
                !('remove_negative_infinity' in p) &&
                !('remove_object' in p) &&
                !('remove_array' in p) &&
                !('remove_dom' in p) &&
                !('remove_function' in p) &&
                testResult.originalUnmutated;

            await recordResult(
                'T01',
                'trackGA4 參數清理與安全防護',
                validCleaning ? 'PASS' : 'FAIL',
                'Only valid primitive params kept, illegal types removed, original unmutated',
                JSON.stringify(p),
                testResult
            );
            await page.close();
        }

        // T02: 只改變篩選值
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            await page.select('#airport-select', '桃園國際機場');
            await new Promise((r) => setTimeout(r, 200));

            const firstDestOption = await page.evaluate(() => {
                const opts = Array.from(document.getElementById('destination-select').options);
                const valid = opts.find((o) => o.value !== '');
                return valid ? valid.value : '';
            });

            if (firstDestOption) {
                await page.select('#destination-select', firstDestOption);
            }

            await page.select('#start-year', '2024');
            await page.select('#start-month', '2');

            const eventCount = await page.evaluate(() => window.__ga4TestCalls.length);

            await recordResult(
                'T02',
                '只改變篩選值不發送事件',
                eventCount === 0 ? 'PASS' : 'FAIL',
                '0 events tracked on dropdown change without apply button click',
                `${eventCount} events tracked`
            );
            await page.close();
        }

        // T03: 一般有結果查詢
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            await page.select('#airport-select', '桃園國際機場');
            await new Promise((r) => setTimeout(r, 200));

            const destValue = await page.evaluate(() => {
                const opts = Array.from(document.getElementById('destination-select').options);
                const valid = opts.find((o) => o.value !== '');
                return valid ? valid.value : '';
            });

            if (destValue) {
                await page.select('#destination-select', destValue);
            }

            await page.select('#start-year', '2024');
            await page.select('#start-month', '1');
            await page.select('#end-year', '2025');
            await page.select('#end-month', '10');

            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.click('#apply-filters');
            await new Promise((r) => setTimeout(r, 300));

            const eventDetails = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                const searchCalls = calls.filter((c) => c[1] === 'search');
                const noResultCalls = calls.filter((c) => c[1] === 'no_search_results');
                return {
                    searchCount: searchCalls.length,
                    noResultCount: noResultCalls.length,
                    params: searchCalls.length > 0 ? searchCalls[0][2] : null
                };
            });

            const p = eventDetails.params;
            const pass =
                eventDetails.searchCount === 1 &&
                eventDetails.noResultCount === 0 &&
                p &&
                p.airport === '桃園國際機場' &&
                p.destination === destValue &&
                p.start_period === '2024-01' &&
                p.end_period === '2025-10' &&
                p.search_term === `桃園國際機場|${destValue}|2024-01_2025-10` &&
                typeof p.result_count === 'number' &&
                Number.isInteger(p.result_count) &&
                p.result_count > 0 &&
                p.search_term.length <= 100;

            await recordResult(
                'T03',
                '一般有結果查詢 (search:1, no_search_results:0)',
                pass ? 'PASS' : 'FAIL',
                'search=1, no_search_results=0, result_count > 0 (Number integer), search_term.length <= 100',
                JSON.stringify(eventDetails)
            );
            await page.close();
        }

        // T04: 全部機場與全部目的地
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            await page.select('#airport-select', '');
            await page.select('#destination-select', '');

            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.click('#apply-filters');
            await new Promise((r) => setTimeout(r, 300));

            const eventDetails = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                const searchCalls = calls.filter((c) => c[1] === 'search');
                return {
                    searchCount: searchCalls.length,
                    params: searchCalls.length > 0 ? searchCalls[0][2] : null
                };
            });

            const p = eventDetails.params;
            const pass =
                eventDetails.searchCount === 1 &&
                p &&
                p.airport === 'all_airports' &&
                p.destination === 'all_destinations' &&
                p.search_term.startsWith('all_airports|all_destinations|') &&
                typeof p.result_count === 'number' &&
                Number.isInteger(p.result_count) &&
                p.result_count > 0 &&
                p.search_term.length <= 100;

            await recordResult(
                'T04',
                '全部機場與全部目的地 (all_airports / all_destinations)',
                pass ? 'PASS' : 'FAIL',
                'airport=all_airports, destination=all_destinations, result_count > 0',
                JSON.stringify(eventDetails)
            );
            await page.close();
        }

        // T05: 無結果查詢
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            // Set invalid date range: start 2025-10 > end 2024-01
            await page.select('#start-year', '2025');
            await page.select('#start-month', '10');
            await page.select('#end-year', '2024');
            await page.select('#end-month', '1');

            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.click('#apply-filters');
            await new Promise((r) => setTimeout(r, 300));

            const eventDetails = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                const searchCalls = calls.filter((c) => c[1] === 'search');
                const noResultCalls = calls.filter((c) => c[1] === 'no_search_results');
                return {
                    searchCount: searchCalls.length,
                    noResultCount: noResultCalls.length,
                    searchParams: searchCalls.length > 0 ? searchCalls[0][2] : null,
                    noResultParams: noResultCalls.length > 0 ? noResultCalls[0][2] : null
                };
            });

            const sp = eventDetails.searchParams;
            const np = eventDetails.noResultParams;
            const pass =
                eventDetails.searchCount === 1 &&
                eventDetails.noResultCount === 1 &&
                sp &&
                np &&
                sp.result_count === 0 &&
                np.result_count === 0 &&
                sp.airport === np.airport &&
                sp.destination === np.destination &&
                sp.start_period === np.start_period &&
                sp.end_period === np.end_period &&
                sp.search_term === np.search_term;

            await recordResult(
                'T05',
                '無結果查詢 (search:1, no_search_results:1, result_count:0)',
                pass ? 'PASS' : 'FAIL',
                'search=1, no_search_results=1, result_count=0 in both, params match',
                JSON.stringify(eventDetails)
            );
            await page.close();
        }

        // T06: Render 不重複送出
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.click('#apply-filters'); // search: 1
            await new Promise((r) => setTimeout(r, 200));

            await page.evaluate(() => {
                window.updateDashboard();
                window.updateDashboard();
            }); // search should remain 1

            const countAfterDirectUpdate = await page.evaluate(
                () => window.__ga4TestCalls.filter((c) => Array.from(c)[1] === 'search').length
            );

            await page.click('#apply-filters'); // search: 2
            await new Promise((r) => setTimeout(r, 200));
            await page.click('#apply-filters'); // search: 3
            await new Promise((r) => setTimeout(r, 200));

            const countFinal = await page.evaluate(
                () => window.__ga4TestCalls.filter((c) => Array.from(c)[1] === 'search').length
            );

            const pass = countAfterDirectUpdate === 1 && countFinal === 3;
            await recordResult(
                'T06',
                'Render/Chart Update 不重複送出事件',
                pass ? 'PASS' : 'FAIL',
                'Direct updateDashboard() adds 0 search events, apply clicks increment exactly by 1',
                `countAfterDirectUpdate: ${countAfterDirectUpdate}, countFinal: ${countFinal}`
            );
            await page.close();
        }

        // T07: 重置已選條件
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            await page.select('#airport-select', '桃園國際機場');
            await new Promise((r) => setTimeout(r, 200));

            const destValue = await page.evaluate(() => {
                const opts = Array.from(document.getElementById('destination-select').options);
                const valid = opts.find((o) => o.value !== '');
                return valid ? valid.value : '';
            });

            if (destValue) {
                await page.select('#destination-select', destValue);
            }

            await page.select('#start-year', '2024');
            await page.select('#start-month', '3');
            await page.select('#end-year', '2025');
            await page.select('#end-month', '8');

            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.click('#reset-filters');
            await new Promise((r) => setTimeout(r, 300));

            const eventDetails = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                const resetCalls = calls.filter((c) => c[1] === 'filter_reset');
                const searchCalls = calls.filter((c) => c[1] === 'search');
                return {
                    resetCount: resetCalls.length,
                    searchCount: searchCalls.length,
                    params: resetCalls.length > 0 ? resetCalls[0][2] : null,
                    airportValue: document.getElementById('airport-select').value,
                    destValue: document.getElementById('destination-select').value,
                    url: window.location.href
                };
            });

            const p = eventDetails.params;
            const pass =
                eventDetails.resetCount === 1 &&
                eventDetails.searchCount === 0 &&
                p &&
                p.previous_airport === '桃園國際機場' &&
                p.previous_destination === destValue &&
                p.previous_start_period === '2024-03' &&
                p.previous_end_period === '2025-08' &&
                eventDetails.airportValue === '' &&
                eventDetails.destValue === '' &&
                !eventDetails.url.includes('airport=');

            await recordResult(
                'T07',
                '重置已選條件 (filter_reset:1, search:0, previous params match)',
                pass ? 'PASS' : 'FAIL',
                'filter_reset=1, search=0, previous params captured correctly, select cleared',
                JSON.stringify(eventDetails)
            );
            await page.close();
        }

        // T08: 重置預設條件
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.click('#reset-filters');
            await new Promise((r) => setTimeout(r, 300));

            const eventDetails = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                const resetCalls = calls.filter((c) => c[1] === 'filter_reset');
                return {
                    resetCount: resetCalls.length,
                    params: resetCalls.length > 0 ? resetCalls[0][2] : null
                };
            });

            const p = eventDetails.params;
            const pass =
                eventDetails.resetCount === 1 &&
                p &&
                p.previous_airport === 'all_airports' &&
                p.previous_destination === 'all_destinations';

            await recordResult(
                'T08',
                '重置預設條件 (previous_airport: all_airports)',
                pass ? 'PASS' : 'FAIL',
                'previous_airport=all_airports, previous_destination=all_destinations',
                JSON.stringify(eventDetails)
            );
            await page.close();
        }

        // Helper function for share mocks sanity check & execute
        async function runShareTest(testId, name, mockSetupFn, expectedMethod, expectedShareCount, expectedSuccessUI) {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            // Install Mock
            await page.evaluate(mockSetupFn);

            // Clear calls before running actual test
            await page.evaluate(() => (window.__ga4TestCalls = []));

            await page.click('#share-filters');
            await new Promise((r) => setTimeout(r, 400));

            const eventDetails = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                const shareCalls = calls.filter((c) => c[1] === 'share');
                const btn = document.getElementById('share-filters');
                const toast = document.getElementById('share-toast');
                return {
                    shareCount: shareCalls.length,
                    params: shareCalls.length > 0 ? shareCalls[0][2] : null,
                    btnShared: btn ? btn.classList.contains('shared') : false,
                    toastShown: toast ? toast.classList.contains('show') : false
                };
            });

            const p = eventDetails.params;
            let pass = eventDetails.shareCount === expectedShareCount;
            if (expectedShareCount > 0) {
                pass =
                    pass &&
                    p &&
                    p.method === expectedMethod &&
                    p.content_type === 'flight_data_dashboard' &&
                    p.item_id.startsWith('flight|all_airports|all_destinations|') &&
                    p.item_id.length <= 100;
            }

            if (expectedSuccessUI) {
                pass = pass && (eventDetails.btnShared || eventDetails.toastShown);
            } else {
                pass = pass && !eventDetails.btnShared && !eventDetails.toastShown;
            }

            await recordResult(
                testId,
                name,
                pass ? 'PASS' : 'FAIL',
                `shareCount=${expectedShareCount}, method=${expectedMethod}, successUI=${expectedSuccessUI}`,
                JSON.stringify(eventDetails)
            );

            await page.close();
        }

        // T09: Web Share 成功
        await runShareTest(
            'T09',
            'Web Share 成功 (method: web_share)',
            () => {
                Object.defineProperty(navigator, 'share', {
                    value: () => Promise.resolve(),
                    configurable: true,
                    writable: true
                });
            },
            'web_share',
            1,
            true
        );

        // T10: Web Share 取消 (AbortError)
        await runShareTest(
            'T10',
            'Web Share 取消 (AbortError, share:0, no fallback)',
            () => {
                Object.defineProperty(navigator, 'share', {
                    value: () => Promise.reject(new DOMException('abort', 'AbortError')),
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: () => Promise.resolve() },
                    configurable: true,
                    writable: true
                });
            },
            null,
            0,
            false
        );

        // T11: Web Share 非 AbortError (Fallback Clipboard 成功)
        await runShareTest(
            'T11',
            'Web Share 非 AbortError (Fallback to clipboard success)',
            () => {
                Object.defineProperty(navigator, 'share', {
                    value: () => Promise.reject(new Error('NotAllowedError')),
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: () => Promise.resolve() },
                    configurable: true,
                    writable: true
                });
            },
            'clipboard',
            1,
            true
        );

        // T12: 不支援 Web Share (Clipboard 成功)
        await runShareTest(
            'T12',
            '不支援 Web Share (Direct clipboard success)',
            () => {
                Object.defineProperty(navigator, 'share', {
                    value: undefined,
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: () => Promise.resolve() },
                    configurable: true,
                    writable: true
                });
            },
            'clipboard',
            1,
            true
        );

        // T13: Clipboard 失敗，execCommand 成功
        await runShareTest(
            'T13',
            'Clipboard API 失敗, execCommand 成功',
            () => {
                Object.defineProperty(navigator, 'share', {
                    value: undefined,
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: () => Promise.reject(new Error('Denied')) },
                    configurable: true,
                    writable: true
                });
                document.execCommand = (cmd) => (cmd === 'copy' ? true : false);
            },
            'clipboard',
            1,
            true
        );

        // T14: 所有分享方法失敗
        await runShareTest(
            'T14',
            '所有分享方法皆失敗 (share:0, no success UI)',
            () => {
                Object.defineProperty(navigator, 'share', {
                    value: undefined,
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: () => Promise.reject(new Error('Denied')) },
                    configurable: true,
                    writable: true
                });
                document.execCommand = (cmd) => false;
            },
            null,
            0,
            false
        );

        // T15: window.gtag 不存在
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);

            const warnings = [];
            page.on('console', (msg) => {
                if (msg.type() === 'warning' || msg.type() === 'warn') {
                    warnings.push(msg.text());
                }
            });

            await page.evaluate(() => {
                window.gtag = undefined;
            });

            await page.click('#apply-filters');
            await new Promise((r) => setTimeout(r, 300));

            const appIntact = await page.evaluate(() => {
                return (
                    document.getElementById('kpi-passengers-value') &&
                    document.getElementById('kpi-passengers-value').textContent !== ''
                );
            });

            const ga4Warnings = warnings.filter((w) =>
                w.includes('GA4 unavailable, skipping event tracking')
            );

            const pass = appIntact && ga4Warnings.length === 1;

            await recordResult(
                'T15',
                'window.gtag 不存在時網站正常發出 1 次 Warning',
                pass ? 'PASS' : 'FAIL',
                'App functions normally, exactly 1 GA4 unavailable warning logged',
                `appIntact: ${appIntact}, ga4Warnings: ${ga4Warnings.length}`
            );
            await page.close();
        }

        // T16: 下載功能與手動事件檢查
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            const domDownloadCheck = await page.evaluate(() => {
                const csvEl = document.getElementById('download-csv-link');
                const jsonEl = document.getElementById('download-json-link');
                return {
                    csvExists: !!csvEl,
                    csvHref: csvEl ? csvEl.getAttribute('href') : '',
                    csvHasDownload: csvEl ? csvEl.hasAttribute('download') : false,
                    jsonExists: !!jsonEl,
                    jsonHref: jsonEl ? jsonEl.getAttribute('href') : '',
                    jsonHasDownload: jsonEl ? jsonEl.hasAttribute('download') : false
                };
            });

            // Trigger clicks dynamically and check manual file_download count
            await page.evaluate(() => (window.__ga4TestCalls = []));
            await page.evaluate(() => {
                const csvEl = document.getElementById('download-csv-link');
                if (csvEl) csvEl.click();
                const jsonEl = document.getElementById('download-json-link');
                if (jsonEl) jsonEl.click();
            });

            const manualFileDownloadCalls = await page.evaluate(() => {
                return window.__ga4TestCalls.filter((c) => Array.from(c)[1] === 'file_download').length;
            });

            // HTTP Verification using native http.get
            const fetchUrl = (url) =>
                new Promise((resolve, reject) => {
                    http.get(url, (res) => {
                        let data = '';
                        res.on('data', (chunk) => (data += chunk));
                        res.on('end', () => resolve({ status: res.statusCode, data }));
                    }).on('error', reject);
                });

            const csvRes = await fetchUrl(`${BASE_URL}/data/flight_data_all.csv`);
            const jsonRes = await fetchUrl(`${BASE_URL}/data/flight_data_all.json`);
            let jsonBody = [];
            try {
                jsonBody = JSON.parse(jsonRes.data);
            } catch (e) {}

            // Source template check
            const templateContent = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
            const templateHasCsvPlaceholder = templateContent.includes('/data/flight_data.csv');
            const templateHasJsonPlaceholder = templateContent.includes('/data/flight_data.json');

            // Static scan of production js/app.js
            const appJsContent = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
            const hasManualEventInCode =
                appJsContent.includes("trackGA4('file_download'") ||
                appJsContent.includes('trackGA4("file_download"') ||
                appJsContent.includes("gtag('event', 'file_download'") ||
                appJsContent.includes('gtag("event", "file_download"');

            const pass =
                domDownloadCheck.csvExists &&
                domDownloadCheck.csvHref === '/data/flight_data_all.csv' &&
                domDownloadCheck.csvHasDownload &&
                domDownloadCheck.jsonExists &&
                domDownloadCheck.jsonHref === '/data/flight_data_all.json' &&
                domDownloadCheck.jsonHasDownload &&
                csvRes.status === 200 &&
                csvRes.data.length > 0 &&
                csvRes.data.includes('\n') &&
                jsonRes.status === 200 &&
                Array.isArray(jsonBody) &&
                jsonBody.length > 0 &&
                templateHasCsvPlaceholder &&
                templateHasJsonPlaceholder &&
                manualFileDownloadCalls === 0 &&
                !hasManualEventInCode;

            await recordResult(
                'T16',
                '下載功能與手動 file_download 事件檢查',
                pass ? 'PASS' : 'FAIL',
                'CSV/JSON 200 OK, template has placeholders, 0 manual file_download events',
                `manualFileDownloadCalls: ${manualFileDownloadCalls}, csvStatus: ${csvRes.status}, jsonStatus: ${jsonRes.status}`
            );
            await page.close();
        }

        // T17: GA4 安裝唯一性
        {
            const filesToAudit = [
                { path: 'template.html', name: 'template.html' },
                { path: 'index.html', name: 'index.html' },
                { path: 'airport/tpe/index.html', name: 'airport/tpe/index.html' },
                { path: 'airline/cal/index.html', name: 'airline/cal/index.html' },
                { path: 'about/index.html', name: 'about/index.html' }
            ];

            let allAuditPass = true;
            const auditDetails = [];

            for (const fileObj of filesToAudit) {
                const fullP = path.join(__dirname, '..', fileObj.path);
                if (!fs.existsSync(fullP)) continue;
                const content = fs.readFileSync(fullP, 'utf8');

                const loaderCount = (content.match(/googletagmanager\.com\/gtag\/js\?id=G-ZS0NCFZ2K3/g) || []).length;
                const configCount = (content.match(/gtag\('config',\s*'G-ZS0NCFZ2K3'\)/g) || []).length;
                const otherGa4Count = (content.match(/G-[A-Z0-9]{8,12}/g) || []).filter(
                    (id) => id !== 'G-ZS0NCFZ2K3'
                ).length;
                const gtmCount = (content.match(/googletagmanager\.com\/gtm\.js/g) || []).length;
                const pageViewCount = (content.match(/gtag\('event',\s*'page_view'/g) || []).length;

                const filePass =
                    loaderCount === 1 &&
                    configCount === 1 &&
                    otherGa4Count === 0 &&
                    gtmCount === 0 &&
                    pageViewCount === 0;
                if (!filePass) allAuditPass = false;

                auditDetails.push({
                    file: fileObj.name,
                    loaderCount,
                    configCount,
                    otherGa4Count,
                    gtmCount,
                    pageViewCount,
                    filePass
                });
            }

            // Informational Audit for Insights page
            const insightsP = path.join(
                __dirname,
                '..',
                'insights',
                '2026-taiwan-aviation-market-outlook',
                'index.html'
            );
            if (fs.existsSync(insightsP)) {
                const content = fs.readFileSync(insightsP, 'utf8');
                const hasGa = content.includes('G-ZS0NCFZ2K3');
                const hasAppJs = content.includes('js/app.js');
                auditDetails.push({ file: 'insights_page_informational', hasGa, hasAppJs });
            }

            await recordResult(
                'T17',
                'GA4 安裝唯一性 audit (loader:1, config:1, no duplicates, no GTM)',
                allAuditPass ? 'PASS' : 'FAIL',
                'Exactly 1 loader and 1 config per page, no extra GA IDs, no GTM',
                JSON.stringify(auditDetails)
            );
        }

        // T18: Cache Version 與 Build 一致性
        {
            const filesToCheck = [
                'index.html',
                'airport/tpe/index.html',
                'airline/cal/index.html'
            ];

            const expectedScriptTag = '/js/app.js?v=20260725-ga4';
            let allVersionsMatch = true;
            const versionDetails = [];

            for (const relP of filesToCheck) {
                const fullP = path.join(__dirname, '..', relP);
                if (!fs.existsSync(fullP)) continue;
                const content = fs.readFileSync(fullP, 'utf8');
                const hasExpected = content.includes(expectedScriptTag);
                if (!hasExpected) allVersionsMatch = false;
                versionDetails.push({ file: relP, hasExpected });
            }

            await recordResult(
                'T18',
                'Cache Version 與 Build 一致性 (?v=20260725-ga4)',
                allVersionsMatch ? 'PASS' : 'FAIL',
                `All generated pages contain ${expectedScriptTag}`,
                JSON.stringify(versionDetails)
            );
        }

        // T19: Production Code 無測試殘留
        {
            const filesToScan = [
                'template.html',
                'js/app.js',
                'js/charts.js',
                'js/insights.js',
                'js/table.js',
                'prerender.js',
                'index.html'
            ];

            let clean = true;
            const leftoversFound = [];

            for (const relP of filesToScan) {
                const fullP = path.join(__dirname, '..', relP);
                if (!fs.existsSync(fullP)) continue;
                const content = fs.readFileSync(fullP, 'utf8');

                if (content.includes('debug_mode')) {
                    clean = false;
                    leftoversFound.push({ file: relP, item: 'debug_mode' });
                }
                if (content.includes('__ga4TestCalls')) {
                    clean = false;
                    leftoversFound.push({ file: relP, item: '__ga4TestCalls' });
                }
                if (content.includes("trackGA4('test_event'") || content.includes('trackGA4("test_event"')) {
                    clean = false;
                    leftoversFound.push({ file: relP, item: 'test_event' });
                }
            }

            await recordResult(
                'T19',
                'Production Code 無測試殘留',
                clean ? 'PASS' : 'FAIL',
                'No debug_mode, __ga4TestCalls, or test_event in production code',
                JSON.stringify(leftoversFound)
            );
        }

        // T20: Desktop 與 Mobile Viewport 無 Error 流程驗證
        {
            let desktopOk = true;
            let mobileOk = true;

            for (const mode of ['desktop', 'mobile']) {
                const viewport = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
                const page = await setupPage(viewport);
                await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
                await waitForAppReady(page);
                await installGA4Stub(page);

                // Select -> Apply -> Reset -> Share
                await page.select('#airport-select', '桃園國際機場');
                await new Promise((r) => setTimeout(r, 200));

                await page.click('#apply-filters');
                await new Promise((r) => setTimeout(r, 200));

                await page.click('#reset-filters');
                await new Promise((r) => setTimeout(r, 200));

                // Mock clipboard for share test
                await page.evaluate(() => {
                    Object.defineProperty(navigator, 'share', {
                        value: undefined,
                        configurable: true,
                        writable: true
                    });
                    Object.defineProperty(navigator, 'clipboard', {
                        value: { writeText: () => Promise.resolve() },
                        configurable: true,
                        writable: true
                    });
                });

                await page.click('#share-filters');
                await new Promise((r) => setTimeout(r, 300));

                const activeErrors = consoleErrorsGlobal.filter(
                    (e) => !e.text.includes('chrome-extension') && !e.text.includes('favicon') && !e.text.includes('ERR_FAILED')
                );

                if (mode === 'desktop' && activeErrors.length > 0) desktopOk = false;
                if (mode === 'mobile' && activeErrors.length > 0) mobileOk = false;

                await page.close();
            }

            const pass = desktopOk && mobileOk;
            await recordResult(
                'T20',
                'Desktop (1280x720) 與 Mobile (390x844) 流程全通過',
                pass ? 'PASS' : 'FAIL',
                'No console errors on desktop or mobile mode',
                `desktopOk: ${desktopOk}, mobileOk: ${mobileOk}`
            );
        }

        // T21: 命名、型別與資料安全
        {
            const page = await setupPage();
            await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
            await waitForAppReady(page);
            await installGA4Stub(page);

            // Trigger search, filter_reset, share
            await page.click('#apply-filters');
            await page.click('#reset-filters');

            await page.evaluate(() => {
                Object.defineProperty(navigator, 'share', {
                    value: undefined,
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(navigator, 'clipboard', {
                    value: { writeText: () => Promise.resolve() },
                    configurable: true,
                    writable: true
                });
            });
            await page.click('#share-filters');
            await new Promise((r) => setTimeout(r, 300));

            const safetyCheck = await page.evaluate(() => {
                const calls = window.__ga4TestCalls.map((c) => Array.from(c));
                let allSnakeCase = true;
                let noPii = true;
                let noDomOrFunction = true;
                let validLengths = true;

                const snakeCaseRegex = /^[a-z0-9_]+$/;

                for (const call of calls) {
                    if (call[0] !== 'event') continue;
                    const eventName = call[1];
                    if (!snakeCaseRegex.test(eventName)) allSnakeCase = false;

                    const params = call[2] || {};
                    for (const key in params) {
                        if (!snakeCaseRegex.test(key)) allSnakeCase = false;
                        const val = params[key];

                        if (typeof val === 'string') {
                            if (val.includes('@') || val.includes('http://') || val.includes('https://')) {
                                noPii = false;
                            }
                        }

                        if (key === 'search_term' || key === 'item_id') {
                            if (typeof val === 'string' && val.length > 100) validLengths = false;
                        }

                        if (typeof val === 'object' || typeof val === 'function') {
                            noDomOrFunction = false;
                        }
                    }
                }

                return { allSnakeCase, noPii, noDomOrFunction, validLengths };
            });

            const pass =
                safetyCheck.allSnakeCase &&
                safetyCheck.noPii &&
                safetyCheck.noDomOrFunction &&
                safetyCheck.validLengths;

            await recordResult(
                'T21',
                '命名 (snake_case)、型別與資料安全驗證',
                pass ? 'PASS' : 'FAIL',
                'All event & param names snake_case, no PII/URL, no objects, lengths <= 100',
                JSON.stringify(safetyCheck)
            );
            await page.close();
        }
    } catch (err) {
        hasFatalError = true;
        console.error('Fatal error during GA4 testing suite:', err);
    } finally {
        await browser.close();
        await new Promise((resolve) => server.close(resolve));
        console.log('Local GA4 server stopped.');
    }

    const totalCount = testResults.length;
    const passCount = testResults.filter((r) => r.status === 'PASS').length;
    const failCount = testResults.filter((r) => r.status === 'FAIL').length;

    const reportData = {
        timestamp: new Date().toISOString(),
        browser: browserPath,
        base_url: BASE_URL,
        blocked_ga_requests_count: blockedGARequestsCount,
        results: testResults,
        console_errors: consoleErrorsGlobal,
        console_warnings: consoleWarningsGlobal,
        summary: {
            total: totalCount,
            pass: passCount,
            fail: failCount
        }
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(reportData, null, 2), 'utf8');
    console.log(`=== GA4 Verification Summary ===`);
    console.log(`Total: ${totalCount} | PASS: ${passCount} | FAIL: ${failCount}`);
    console.log(`Blocked GA Requests: ${blockedGARequestsCount}`);
    console.log(`Report written to ${REPORT_PATH}`);

    if (failCount > 0 || hasFatalError || totalCount < 22) {
        console.error(`❌ GA4 Verification Suite FAILED with ${failCount} failures (Fatal: ${hasFatalError}, Executed: ${totalCount}/22).`);
        process.exit(1);
    } else {
        console.log(`🎉 GA4 Verification Suite 100% PASSED! (${passCount}/22 tests)`);
        process.exit(0);
    }
}

runGA4Tests();
