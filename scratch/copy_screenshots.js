const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'tests', 'screenshots');
const destDir = '/Users/pmpmpm/.gemini/antigravity/brain/17a18af6-990d-4414-9402-d0a50a5ed533';

const files = [
    'desktop_above_the_fold.png',
    'desktop_q5_q10.png',
    'mobile_above_the_fold.png',
    'mobile_toc_area.png',
    'mobile_charts_tables.png'
];

files.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file} to artifacts successfully.`);
    } else {
        console.warn(`Source file not found: ${file}`);
    }
});
