const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const extractedDir = path.join(__dirname, 'extracted');
const outputPath = path.join(__dirname, 'data', 'flight_data.json');

function parseYearMonthFromFilename(filename) {
    // filename like 111年1月.xls (Minguo year) or 112年12月.xls
    const match = filename.match(/(\d{2,3})年(\d{1,2})月/);
    if (!match) return null;
    const minguo = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = 1911 + minguo; // Convert to Gregorian year
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    return ym;
}

function extractTotalRow(sheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // Find row where any cell is '總計'
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.some(cell => typeof cell === 'string' && cell.trim() === '總計')) {
            return row;
        }
    }
    return null;
}

function processFile(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const totalRow = extractTotalRow(sheet);
    if (!totalRow) return null;
    // Expected columns after '總計': empty, flights, seats, passengers, loadFactor, ... (repeat for outbound)
    // We'll take the first set after the empty column.
    const flights = parseInt(totalRow[2] || 0, 10);
    const seats = parseInt(totalRow[3] || 0, 10);
    const passengers = parseInt(totalRow[4] || 0, 10);
    const loadFactor = parseFloat(totalRow[5] || 0);
    const yearMonth = parseYearMonthFromFilename(path.basename(filePath));
    if (!yearMonth) return null;
    return { yearMonth, flights, totalSeats: seats, passengers, loadFactor };
}

function main() {
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'));
    }
    const results = [];
    const files = fs.readdirSync(extractedDir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
    for (const file of files) {
        const fullPath = path.join(extractedDir, file);
        const rec = processFile(fullPath);
        if (rec) {
            results.push(rec);
        }
    }
    // Sort by yearMonth
    results.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Processed ${results.length} files. Output written to ${outputPath}`);
}

main();
