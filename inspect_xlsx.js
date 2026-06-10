#!/usr/bin/env node
/**
 * Simple Node.js script to convert one XLSX file to see the structure
 * Run: node inspect_xlsx.js
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function inspectFile(filePath) {
    console.log('Reading:', filePath);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    console.log('Total rows:', data.length);
    // Find header row (row with "航線" etc.)
    let headerIdx = -1;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row.includes('航線') && row.includes('航空公司')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) { console.log('Header not found'); return; }
    const headers = data[headerIdx];
    console.log('Header row index:', headerIdx);
    console.log('Headers:', headers);
    const firstDataRow = data[headerIdx + 1];
    console.log('First data row:', firstDataRow);
}

const dir = path.join(__dirname, 'extracted');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

if (files.length > 0) {
    const f = files[0]; // Just check one file for structure
    console.log('Inspecting file:', f);
    const filePath = path.join(dir, f);
    const workbook = XLSX.readFile(filePath);

    console.log('Sheet Names:', workbook.SheetNames);

    for (const sheetName of workbook.SheetNames) {
        if (sheetName.includes('36-2')) {
            console.log(`\nFile: ${f} | Sheet: ${sheetName}`);
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            // Filter out empty rows
            const nonEmptyRows = data.filter(row => row.some(cell => cell !== ''));
            // Print first 50 non-empty rows
            console.log(JSON.stringify(nonEmptyRows.slice(0, 50), null, 2));
            break;
        }
    }
} else {
    console.log('No Excel files found.');
}
