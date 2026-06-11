const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Setup minimal static file server to host our built website
const PORT = 3033;
const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0]; // strip query string
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

// Run verification suite
async function runTests() {
    console.log('=== Starting Headless Browser QA Verification Suite ===');
    
    // Ensure screenshots folder exists
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Start local server
    await new Promise((resolve) => server.listen(PORT, resolve));
    console.log(`Local server running at http://localhost:${PORT}`);
    
    const targetUrl = `http://localhost:${PORT}/insights/2026-taiwan-aviation-market-outlook/`;
    
    const results = [];
    const screenshots = [];
    let errorLog = [];
    let warnLog = [];

    // Launch Chrome
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // Run test iterations for both Mobile and Desktop
        for (const viewportType of ['desktop', 'mobile']) {
            const isMobile = viewportType === 'mobile';
            const width = isMobile ? 390 : 1280;
            const height = isMobile ? 844 : 720;
            
            const page = await browser.newPage();
            await page.setViewport({ width, height });
            
            // Collect page errors & warnings (excluding browser-internal extensions or third party stuff)
            page.on('console', msg => {
                const text = msg.text();
                const type = msg.type();
                const isExternal = text.includes('chrome-extension') || text.includes('Google Fonts') || text.includes('favicon') || text.includes('Chart.js');
                if (!isExternal) {
                    if (type === 'error') errorLog.push({ viewport: viewportType, text });
                    if (type === 'warning') warnLog.push({ viewport: viewportType, text });
                }
            });

            console.log(`Navigating to ${targetUrl} in ${viewportType} mode (${width}x${height})...`);
            await page.goto(targetUrl, { waitUntil: 'networkidle0' });
            // Wait for animations and Chart.js rendering
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Assertion 1: Horizontal Scrollbar Overflow Check
            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
            const overflowPx = Math.max(0, scrollWidth - clientWidth);
            
            results.push({
                id: 1,
                name: `viewport_overflow_${viewportType}`,
                status: overflowPx <= 1 ? 'PASS' : 'FAIL',
                details: `scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}, overflow: ${overflowPx}px (tolerance: 1px)`
            });

            if (isMobile) {
                // Screenshot 1: Mobile above the fold
                const ssPath1 = path.join(screenshotDir, 'mobile_above_the_fold.png');
                await page.screenshot({ path: ssPath1 });
                screenshots.push({ name: 'mobile_above_the_fold', path: ssPath1, overflowPx, viewport: '390x844' });

                // Assertion 4: Mobile Tap Targets (>= 44px)
                const tapTargetSizes = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('.nav-link, .toc-item a'));
                    return links.map(link => {
                        const rect = link.getBoundingClientRect();
                        return {
                            text: link.innerText.trim(),
                            selector: link.className ? `.${link.className}` : link.tagName,
                            height: rect.height,
                            width: rect.width
                        };
                    });
                });

                let allTargetsPass = true;
                const failedTargets = [];
                for (const target of tapTargetSizes) {
                    if (target.height < 44) {
                        allTargetsPass = false;
                        failedTargets.push(`${target.text} (${target.height}px)`);
                    }
                }

                results.push({
                    id: 4,
                    name: 'tap_target_sizes_mobile',
                    status: allTargetsPass ? 'PASS' : 'FAIL',
                    details: allTargetsPass 
                        ? `All ${tapTargetSizes.length} targets verified >= 44px.` 
                        : `Failed targets: ${failedTargets.join(', ')}`
                });

                // Scroll to TOC and take screenshot 2
                await page.evaluate(() => {
                    document.querySelector('.toc-box').scrollIntoView();
                });
                await new Promise(resolve => setTimeout(resolve, 200));
                const ssPath2 = path.join(screenshotDir, 'mobile_toc_area.png');
                await page.screenshot({ path: ssPath2 });
                screenshots.push({ name: 'mobile_toc_area', path: ssPath2, viewport: '390x844' });

                // Assertion 5: TOC Anchor scroll behavior mobile (static header, top is around 0 ~ 100px)
                await page.click('a[href="#q5"]');
                await new Promise(resolve => setTimeout(resolve, 800)); // wait for scroll
                const q5TopMobile = await page.evaluate(() => {
                    const rect = document.getElementById('q5').getBoundingClientRect();
                    return rect.top;
                });
                results.push({
                    id: 5,
                    name: 'toc_anchor_scroll_mobile',
                    status: (q5TopMobile >= -1 && q5TopMobile <= 100) ? 'PASS' : 'FAIL',
                    details: `Q5 element top coordinate after clicking anchor: ${q5TopMobile}px (expected: 0 ~ 100px)`
                });

                // Screenshot 3: Mobile charts & tables (scroll to Q5 and snap)
                const ssPath3 = path.join(screenshotDir, 'mobile_charts_tables.png');
                await page.screenshot({ path: ssPath3 });
                screenshots.push({ name: 'mobile_charts_tables', path: ssPath3, viewport: '390x844' });

            } else {
                // Screenshot 4: Desktop above the fold
                const ssPath4 = path.join(screenshotDir, 'desktop_above_the_fold.png');
                await page.screenshot({ path: ssPath4 });
                screenshots.push({ name: 'desktop_above_the_fold', path: ssPath4, viewport: '1280x720' });

                // Assertion 6: TOC Anchor scroll behavior desktop (sticky header, top is around headerHeight ~ headerHeight+80px)
                await page.click('a[href="#q5"]');
                await new Promise(resolve => setTimeout(resolve, 800)); // wait for scroll
                const q5TopDesktop = await page.evaluate(() => {
                    const rect = document.getElementById('q5').getBoundingClientRect();
                    const headerRect = document.querySelector('.header').getBoundingClientRect();
                    return { top: rect.top, headerHeight: headerRect.height };
                });
                
                const expectedMin = q5TopDesktop.headerHeight - 5;
                const expectedMax = q5TopDesktop.headerHeight + 85;
                const topPassed = q5TopDesktop.top >= expectedMin && q5TopDesktop.top <= expectedMax;

                results.push({
                    id: 6,
                    name: 'toc_anchor_scroll_desktop',
                    status: topPassed ? 'PASS' : 'FAIL',
                    details: `Q5 element top coordinate: ${q5TopDesktop.top}px, Header height: ${q5TopDesktop.headerHeight}px (expected: ${expectedMin} ~ ${expectedMax}px)`
                });

                // Screenshot 5: Desktop Q5 and Heatmap
                await page.evaluate(() => {
                    document.getElementById('q5').scrollIntoView();
                });
                await new Promise(resolve => setTimeout(resolve, 200));
                const ssPath5 = path.join(screenshotDir, 'desktop_q5_q10.png');
                await page.screenshot({ path: ssPath5 });
                screenshots.push({ name: 'desktop_q5_q10', path: ssPath5, viewport: '1280x720' });

                // Run global DOM/Text assertions once (usually in desktop iteration is fine)
                
                // Assertion 2: H1 Uniqueness
                const h1Info = await page.evaluate(() => {
                    const h1s = Array.from(document.querySelectorAll('h1'));
                    const firstHeading = document.querySelector('h1, h2, h3, h4, h5, h6');
                    const logoTextElement = document.querySelector('.logo-text');
                    return {
                        h1Count: h1s.length,
                        firstHeadingTag: firstHeading ? firstHeading.tagName : 'NONE',
                        logoTagName: logoTextElement ? logoTextElement.tagName : 'NONE'
                    };
                });
                
                const h1Passed = h1Info.h1Count === 1 && h1Info.firstHeadingTag === 'H1' && h1Info.logoTagName !== 'H2';
                results.push({
                    id: 2,
                    name: 'h1_uniqueness_and_hierarchy',
                    status: h1Passed ? 'PASS' : 'FAIL',
                    details: `H1 Count: ${h1Info.h1Count}, First Heading Tag: ${h1Info.firstHeadingTag}, Logo Tag: ${h1Info.logoTagName}`
                });

                // Assertion 3: TOC Typo checking (no 'is哪')
                const htmlTextContent = await page.evaluate(() => document.body.innerText);
                const hasTldTypo = htmlTextContent.includes('is哪');
                results.push({
                    id: 3,
                    name: 'toc_typo_check',
                    status: !hasTldTypo ? 'PASS' : 'FAIL',
                    details: !hasTldTypo ? 'No "is哪" typos found in page text.' : 'Found "is哪" typo in page text.'
                });

                // Assertion 8-11: JSON-LD validation
                const jsonLds = await page.evaluate(() => {
                    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                    return scripts.map(s => {
                        try { return JSON.parse(s.innerHTML); } catch(e) { return null; }
                    });
                });

                let articleNode = null;
                let faqNode = null;
                let datasetNode = null;
                
                jsonLds.forEach(s => {
                    if (s && s['@graph']) {
                        s['@graph'].forEach(node => {
                            if (node['@type'] === 'Article') articleNode = node;
                            if (node['@type'] === 'FAQPage') faqNode = node;
                            if (node['@type'] === 'Dataset' || (node['about'] && node['about']['@type'] === 'Dataset')) {
                                datasetNode = node['@type'] === 'Dataset' ? node : node['about'];
                            }
                        });
                    }
                });

                // 8. JSON-LD Article headline
                const expectedHeadline = "台灣航空市場累計統計與載客率分析";
                const headlinePassed = articleNode && articleNode.headline === expectedHeadline;
                results.push({
                    id: 8,
                    name: 'json_ld_article_headline',
                    status: headlinePassed ? 'PASS' : 'FAIL',
                    details: articleNode 
                        ? `Headline in JSON-LD Article: "${articleNode.headline}"`
                        : `No Article node found in JSON-LD graph.`
                });

                // 9. JSON-LD Dataset temporalCoverage
                const coveragePassed = datasetNode && datasetNode.temporalCoverage === '2024-01/2026-04';
                results.push({
                    id: 9,
                    name: 'json_ld_dataset_temporal_coverage',
                    status: coveragePassed ? 'PASS' : 'FAIL',
                    details: datasetNode 
                        ? `temporalCoverage in JSON-LD Dataset: "${datasetNode.temporalCoverage}"`
                        : `No Dataset node found in JSON-LD.`
                });

                // 10. JSON-LD FAQ Period Correctness
                // Q3, Q4, Q5, Q8 -> 2024-01 至 2026-04 累計
                // Q1, Q6, Q7, Q9 -> 2026 年 1-4 月
                // Q2 -> 2025 全年
                let faqPeriodsPassed = true;
                const faqErrors = [];
                
                if (faqNode && Array.isArray(faqNode.mainEntity)) {
                    const qAndAs = faqNode.mainEntity;
                    
                    const checkPeriod = (index, expectedSubstring) => {
                        const question = qAndAs[index];
                        if (!question) {
                            faqPeriodsPassed = false;
                            faqErrors.push(`Question at index ${index} is missing`);
                            return;
                        }
                        const qText = question.name;
                        const aText = question.acceptedAnswer ? question.acceptedAnswer.text : '';
                        const textToSearch = qText + ' ' + aText;
                        if (!textToSearch.includes(expectedSubstring)) {
                            faqPeriodsPassed = false;
                            faqErrors.push(`Q${index+1} does not mention "${expectedSubstring}"`);
                        }
                    };

                    checkPeriod(0, '2026 年 1-4 月'); // Q1
                    checkPeriod(1, '2025'); // Q2
                    checkPeriod(2, '2024-01 至 2026-04 累計'); // Q3
                    checkPeriod(3, '2024-01 至 2026-04 累計'); // Q4
                    checkPeriod(4, '2024-01 至 2026-04 累計'); // Q5
                    checkPeriod(5, '2026 年 1-4 月'); // Q6
                    checkPeriod(6, '2026 年 1-4 月'); // Q7
                    checkPeriod(7, '2024-01 至 2026-04 累計'); // Q8
                    checkPeriod(8, '2026 年 1-4 月'); // Q9
                } else {
                    faqPeriodsPassed = false;
                    faqErrors.push("FAQPage node missing or empty");
                }

                results.push({
                    id: 10,
                    name: 'json_ld_faq_periods',
                    status: faqPeriodsPassed ? 'PASS' : 'FAIL',
                    details: faqPeriodsPassed
                        ? 'JSON-LD FAQ items correctly include expected period statements.'
                        : `JSON-LD FAQ errors: ${faqErrors.join('; ')}`
                });

                // 11. JSON-LD Forbidden Strings
                // No "出境最熱門航點", no "is哪"
                let forbiddenPassed = true;
                if (faqNode) {
                    const faqStr = JSON.stringify(faqNode);
                    if (faqStr.includes('出境最熱門') || faqStr.includes('is哪')) {
                        forbiddenPassed = false;
                    }
                }
                results.push({
                    id: 11,
                    name: 'json_ld_forbidden_strings',
                    status: forbiddenPassed ? 'PASS' : 'FAIL',
                    details: forbiddenPassed 
                        ? 'No forbidden strings ("出境最熱門" / "is哪") found in JSON-LD FAQ.' 
                        : 'Forbidden strings found in JSON-LD FAQ.'
                });

                // 12. Data source check in page text
                const hasCaaDate = htmlTextContent.includes('115年4月');
                results.push({
                    id: 12,
                    name: 'source_date_check',
                    status: hasCaaDate ? 'PASS' : 'FAIL',
                    details: hasCaaDate 
                        ? 'Page body contains "115年4月".' 
                        : 'Page body does not contain "115年4月".'
                });
            }

            await page.close();
        }

        // Assertion 7: Console Errors / Warnings (Clean console health)
        const consolePassed = errorLog.length === 0 && warnLog.length === 0;
        results.push({
            id: 7,
            name: 'console_health',
            status: consolePassed ? 'PASS' : 'FAIL',
            details: `Errors: ${errorLog.length} (${JSON.stringify(errorLog)}), Warnings: ${warnLog.length} (${JSON.stringify(warnLog)})`
        });

        // Assertion 13: Local raw dataset check
        const xlsPath = path.join(__dirname, '..', 'extracted', '115年4月.xls');
        const fileExists = fs.existsSync(xlsPath) && fs.statSync(xlsPath).size > 0;
        results.push({
            id: 13,
            name: 'raw_data_file_exists',
            status: fileExists ? 'PASS' : 'FAIL',
            details: `File 'extracted/115年4月.xls' size: ${fileExists ? fs.statSync(xlsPath).size + ' bytes' : '0 / NOT FOUND'}`
        });

    } catch (err) {
        console.error('Test Execution Error:', err);
    } finally {
        await browser.close();
        server.close();
        console.log('Local server stopped.');
    }

    // Output JSON report
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    
    const finalReport = {
        timestamp: new Date().toISOString(),
        results,
        screenshots,
        summary: {
            total: results.length,
            pass: passCount,
            fail: failCount
        }
    };

    const reportPath = path.join(__dirname, 'qa_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    console.log(`\n🎉 QA Report written to ${reportPath}`);
    console.log(`=== Summary: Total: ${results.length}, PASS: ${passCount}, FAIL: ${failCount} ===\n`);
    
    if (failCount > 0) {
        console.error('❌ Headless QA Suite failed. Some assertions failed.');
        process.exit(1);
    } else {
        console.log('✅ Headless QA Suite completed successfully with 100% PASS.');
        process.exit(0);
    }
}

runTests();
