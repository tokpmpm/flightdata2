const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'extracted', '114年1月.xls');
console.log('Reading:', filePath);
const workbook = XLSX.readFile(filePath);

['36-2', '36-3'].forEach(sheetName => {
    if (workbook.Sheets[sheetName]) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        console.log(`\nSheet: ${sheetName}`);
        // Print first 5 rows to see title
        for (let i = 0; i < 5; i++) {
            console.log(data[i]);
        }
    } else {
        console.log(`\nSheet ${sheetName} not found`);
    }
});
