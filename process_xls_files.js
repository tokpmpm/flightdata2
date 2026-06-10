#!/usr/bin/env node
/**
 * Process all XLS files and convert to JSON for the website
 * Extracts real passenger load factor data from Taiwan CAA files
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Major destinations to reduce data size
const MAJOR_KEYWORDS = [
    '日本', '東京', '大阪', '福岡', '沖繩', '名古屋', '札幌', '仙台', '北海道',
    '韓國', '首爾', '釜山', '濟州',
    '香港', '澳門',
    '泰國', '曼谷', '普吉', '清邁',
    '新加坡',
    '馬來西亞', '吉隆坡',
    '越南', '胡志明', '河內', '峴港',
    '菲律賓', '馬尼拉', '宿霧',
    '美國', '洛杉磯', '舊金山', '紐約', '西雅圖', '夏威夷',
    '加拿大', '溫哥華', '多倫多',
    '澳洲', '雪梨', '墨爾本', '布里斯本',
    '紐西蘭', '奧克蘭'
];

function isMajorDestination(route) {
    if (!route) return false;
    const routeStr = String(route);
    return MAJOR_KEYWORDS.some(keyword => routeStr.includes(keyword));
}

function processXLSFile(filepath) {
    console.log(`Processing: ${path.basename(filepath)}`);

    try {
        // Extract year and month from filename
        const filename = path.basename(filepath);
        const yearStr = filename.match(/(\d+)年/)[1];
        const monthStr = filename.match(/年(\d+)月/)[1];
        const year = parseInt(yearStr) + 1911; // ROC to AD
        const month = parseInt(monthStr);

        // Read Excel file
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        const records = [];
        let processedCount = 0;

        // Data starts from row 9 (index 9)
        // Headers are at row 7-8
        for (let i = 9; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows or header/summary rows
            if (!row || row.length < 5) continue;
            if (!row[1] || row[1] === '總計') continue;

            const route = String(row[1] || '').trim();
            const airline = String(row[2] || '').trim();

            // Filter for major destinations only
            if (!isMajorDestination(route)) continue;
            if (!airline || airline === '') continue;

            // Extract data - columns: 飛行架次, 座位總數, 載客人數, 載客率
            const flights = parseInt(row[3]) || 0;
            const seats = parseInt(row[4]) || 0;
            const passengers = parseInt(row[5]) || 0;
            const loadFactor = parseFloat(row[6]) || 0;

            // Skip if no meaningful data
            if (flights === 0 && seats === 0 && passengers === 0) continue;

            // Parse route to get airport and destination
            let airport = '桃園國際機場';
            let destination = route;

            if (route.includes('桃園')) {
                airport = '桃園國際機場';
                destination = route.replace(/.*桃園[-–—]\s*/, '').replace(/^[至到]/, '').trim();
            } else if (route.includes('松山')) {
                airport = '松山機場';
                destination = route.replace(/.*松山[-–—]\s*/, '').replace(/^[至到]/, '').trim();
            } else if (route.includes('高雄')) {
                airport = '高雄國際機場';
                destination = route.replace(/.*高雄[-–—]\s*/, '').replace(/^[至到]/, '').trim();
            } else if (route.includes('台中') || route.includes('臺中')) {
                airport = '台中清泉崗機場';
                destination = route.replace(/.*台中[-–—]\s*/, '').replace(/.*臺中[-–—]\s*/, '').replace(/^[至到]/, '').trim();
            }

            // Clean up destination
            destination = destination.replace(/\s+/g, '').trim();
            if (!destination) destination = route;

            records.push({
                year,
                month,
                year_month: `${year}-${String(month).padStart(2, '0')}`,
                airport,
                destination,
                airline,
                flights,
                total_seats: seats,
                passengers,
                load_factor: loadFactor
            });

            processedCount++;
        }

        console.log(`  → Extracted ${processedCount} records`);
        return records;

    } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        return [];
    }
}

function main() {
    console.log('='.repeat(80));
    console.log('Processing Real Passenger Data from Taiwan CAA');
    console.log('='.repeat(80));

    const extractedDir = 'extracted';
    const files = fs.readdirSync(extractedDir)
        .filter(f => f.match(/^11[1-4]年\d+月/) && (f.endsWith('.xls') || f.endsWith('.xlsx')))
        .sort();

    console.log(`\nFound ${files.length} files from 2022-2025\n`);

    let allRecords = [];

    files.forEach(file => {
        const filepath = path.join(extractedDir, file);
        const records = processXLSFile(filepath);
        allRecords = allRecords.concat(records);
    });

    // Save to JSON
    const outputFile = 'data/flight_data.json';
    fs.writeFileSync(outputFile, JSON.stringify(allRecords, null, 2), 'utf-8');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Processing Complete!');
    console.log(`Total records: ${allRecords.length}`);
    console.log(`Output file: ${outputFile}`);
    console.log(`File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);

    // Statistics
    const airports = new Set(allRecords.map(r => r.airport));
    const destinations = new Set(allRecords.map(r => r.destination));
    const airlines = new Set(allRecords.map(r => r.airline));

    console.log(`\nData Summary:`);
    console.log(`  Airports: ${airports.size}`);
    console.log(`  Destinations: ${destinations.size}`);
    console.log(`  Airlines: ${airlines.size}`);
    console.log(`  Date range: ${Math.min(...allRecords.map(r => r.year))}-${Math.max(...allRecords.map(r => r.year))}`);
    console.log('='.repeat(80));
}

main();
