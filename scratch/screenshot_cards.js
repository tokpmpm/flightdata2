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
        await page.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 2 }); // Scale factor 2 for Retina resolution!

        const fileUrl = `file://${path.join(__dirname, '..', 'summer_qa_cards.html')}`;
        console.log(`Loading page: ${fileUrl}...`);
        await page.goto(fileUrl, { waitUntil: 'networkidle0' });

        // Ensure elements are loaded
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

        console.log('=== Screenshots captured successfully! ===');
    } catch (err) {
        console.error('Error during capture:', err);
    } finally {
        await browser.close();
    }
}

captureScreenshots();
