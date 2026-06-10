const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'extracted', '114年1月.xls');
console.log('Reading:', filePath);
const workbook = XLSX.readFile(filePath);

workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    data.forEach((row, index) => {
        const rowStr = JSON.stringify(row);
        if (rowStr.includes('石垣')) {
            console.log(`\nFound in Sheet: ${sheetName}, Row: ${index + 1}`);
            console.log(row);
        }
    });
});
