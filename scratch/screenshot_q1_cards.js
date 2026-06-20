const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
    console.log('=== Capturing Q1 2026 Q&A Card Screenshots ===');
    
    const screenshotDir = path.join(__dirname, '..', 'tests', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });

        const fileUrl = `file://${path.join(__dirname, '..', 'q1_2026_airlines_cards.html')}`;
        console.log(`Loading page: ${fileUrl}...`);
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });

        // Ensure elements are loaded
        await page.waitForSelector('#card-q1');
        await page.waitForSelector('#answer-q1');
        
        // Wait another 1500ms to ensure Web Fonts are fully loaded and layout stabilizes
        await new Promise(resolve => setTimeout(resolve, 1500));

        console.log('Capturing cards using Page Clip at (0,0) and Native Chrome rendering for high quality...');

        // 1. Hide irrelevant elements, collapse page layout to block (0,0)
        await page.evaluate(() => {
            // Hide button-groups, banner, header
            document.querySelectorAll('.button-group, .global-cta-banner, header').forEach(el => {
                el.style.display = 'none';
            });
            
            // Set body display to block to prevent center offsets
            document.body.style.display = 'block';
            document.body.style.padding = '0';
            document.body.style.margin = '0';
            document.body.style.background = '#ffffff';
        });

        // 2. Prepare Question Card at (0,0)
        await page.evaluate(() => {
            const card = document.getElementById('card-q1');
            if (card) {
                card.style.position = 'absolute';
                card.style.left = '0px';
                card.style.top = '0px';
                card.style.margin = '0';
                card.style.transform = 'none';
                card.style.width = '550px';
                card.style.height = '550px';
                card.style.boxShadow = 'none'; // Remove shadow to prevent crop outline issues
            }
        });

        // Wait a tiny moment for layout
        await new Promise(resolve => setTimeout(resolve, 200));

        // Screenshot Page Clip (0,0) to (550,550) for Question Card
        const qPath = path.join(screenshotDir, 'q1_2026_question.png');
        await page.screenshot({
            path: qPath,
            clip: { x: 0, y: 0, width: 550, height: 550 }
        });
        console.log(`Saved Question card to: ${qPath}`);

        // 3. Prepare Answer Card at (0,0)
        await page.evaluate(() => {
            // Hide the question card first
            const qCard = document.getElementById('card-q1');
            if (qCard) qCard.style.display = 'none';

            const answerCard = document.getElementById('answer-q1');
            if (answerCard) {
                answerCard.classList.add('revealed');
                answerCard.style.position = 'absolute';
                answerCard.style.left = '0px';
                answerCard.style.top = '0px';
                answerCard.style.margin = '0';
                answerCard.style.transform = 'none';
                answerCard.style.width = '550px';
                answerCard.style.height = '550px';
                answerCard.style.boxShadow = 'none';

                // Force chart bars to take their target width immediately
                answerCard.querySelectorAll('.chart-bar').forEach(bar => {
                    const targetWidth = bar.getAttribute('data-width');
                    bar.style.width = targetWidth;
                    bar.style.transition = 'none';
                });
            }
        });

        // Wait a small moment for layout and chart render
        await new Promise(resolve => setTimeout(resolve, 500));

        // Screenshot Page Clip (0,0) to (550,550) for Answer Card
        const aPath = path.join(screenshotDir, 'q1_2026_answer.png');
        await page.screenshot({
            path: aPath,
            clip: { x: 0, y: 0, width: 550, height: 550 }
        });
        console.log(`Saved Answer card to: ${aPath}`);

        // Copy screenshots to Artifact Directory to keep walkthrough up-to-date
        const artifactDir = '/Users/pmpmpm/.gemini/antigravity/brain/37e7edf9-b60d-4e39-879a-f38d60851cdd';
        if (fs.existsSync(artifactDir)) {
            fs.copyFileSync(qPath, path.join(artifactDir, 'q1_2026_question.png'));
            fs.copyFileSync(aPath, path.join(artifactDir, 'q1_2026_answer.png'));
            console.log(`Copied screenshots to artifact directory: ${artifactDir}`);
        }

        console.log('=== Screenshots captured successfully! ===');
    } catch (err) {
        console.error('Error during capture:', err);
    } finally {
        await browser.close();
    }
}

captureScreenshots();
