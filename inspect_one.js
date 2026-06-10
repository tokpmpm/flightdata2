const XLSX = require('xlsx');
const path = require('path');
const file = path.join(__dirname, 'extracted', '111年1月.xls');
const wb = XLSX.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
console.log('Total rows:', rows.length);
rows.slice(0, 30).forEach((r, i) => console.log(i, r));
