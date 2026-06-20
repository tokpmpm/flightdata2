const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
    console.log('=== Capturing Q&A Card Screenshots ===');
    
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
        await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 }); // Scale factor 2 for Retina resolution!

        // 1. Capture Summer QA Cards
        const summerFileUrl = `file://${path.join(__dirname, '..', 'summer_qa_cards.html')}`;
        console.log(`Loading page: ${summerFileUrl}...`);
        await page.goto(summerFileUrl, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Delay for layout settling

        await page.waitForSelector('#card-tpe');
        await page.waitForSelector('#card-khh');

        console.log('Capturing Taoyuan card...');
        const tpeCard = await page.$('#card-tpe');
        const tpePath = path.join(screenshotDir, 'tpe_summer_question.png');
        await tpeCard.screenshot({ path: tpePath });
        console.log(`Saved Taoyuan card to: ${tpePath}`);

        console.log('Capturing Kaohsiung card...');
        const khhCard = await page.$('#card-khh');
        const khhPath = path.join(screenshotDir, 'khh_summer_question.png');
        await khhCard.screenshot({ path: khhPath });
        console.log(`Saved Kaohsiung card to: ${khhPath}`);

        // 2. Capture Q1 2026 Airlines QA Cards
        const q1FileUrl = `file://${path.join(__dirname, '..', 'q1_2026_airlines_cards.html')}`;
        console.log(`Loading page: ${q1FileUrl}...`);
        await page.goto(q1FileUrl, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 1500)); // Delay for layout settling

        await page.waitForSelector('#card-q1');
        await page.waitForSelector('#answer-q1');

        console.log('Capturing Q1 2026 Question card...');
        const q1Card = await page.$('#card-q1');
        const q1Path = path.join(screenshotDir, 'q1_2026_question.png');
        await q1Card.screenshot({ path: q1Path });
        console.log(`Saved Q1 2026 Question card to: ${q1Path}`);

        console.log('Triggering Answer Card preview...');
        // Click the preview button to show the answer card and set the bar widths
        await page.click('#btn-preview-answer');
        
        // Wait a short moment for the CSS animations to settle (widths are set after 100ms)
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Capturing Q1 2026 Answer card...');
        const answerCard = await page.$('#answer-q1');
        const answerPath = path.join(screenshotDir, 'q1_2026_answer.png');
        await answerCard.screenshot({ path: answerPath });
        console.log(`Saved Q1 2026 Answer card to: ${answerPath}`);

        console.log('=== Screenshots captured successfully! ===');
    } catch (err) {
        console.error('Error during capture:', err);
    } finally {
        await browser.close();
    }
}

captureScreenshots();
