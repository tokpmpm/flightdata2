const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'data', 'flight_data_all.json');
if (!fs.existsSync(dataPath)) throw new Error('Missing data/flight_data_all.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
if (!Array.isArray(data) || data.length === 0) throw new Error('flight_data_all.json is empty');

const latest = data.reduce((best, r) => {
  const key = Number(r.year) * 100 + Number(r.month);
  return key > best.key ? { key, year: Number(r.year), month: Number(r.month) } : best;
}, { key: 0, year: 0, month: 0 });

const expectedYear = Number(process.env.EXPECTED_YEAR || latest.year);
const expectedMonth = Number(process.env.EXPECTED_MONTH || latest.month);
if (latest.year !== expectedYear || latest.month !== expectedMonth) {
  throw new Error(`Dataset latest month ${latest.year}-${latest.month} != expected ${expectedYear}-${expectedMonth}`);
}

const latestRows = data.filter(r => Number(r.year) === expectedYear && Number(r.month) === expectedMonth);
if (latestRows.length === 0) throw new Error('No rows for expected latest month');
const airports = new Set(latestRows.map(r => r.airport).filter(Boolean));
if (airports.size < 4) throw new Error(`Latest month has suspiciously few airports: ${airports.size}`);

for (const [i, r] of data.entries()) {
  for (const key of ['year', 'month', 'flights', 'passengers']) {
    if (!Number.isFinite(Number(r[key])) || Number(r[key]) < 0) throw new Error(`Invalid ${key} at row ${i}`);
  }
  const seats = Number(r.totalSeats ?? r.seats ?? 0);
  if (!Number.isFinite(seats) || seats < 0) throw new Error(`Invalid seats at row ${i}`);
}

function maxMonth(records) {
  return records.reduce((best, r) => {
    const year = Number(r.year), month = Number(r.month), key = year * 100 + month;
    return key > best.key ? { key, year, month } : best;
  }, { key: 0, year: 0, month: 0 });
}

function assertPage(file, expected) {
  if (!fs.existsSync(file)) throw new Error(`Missing generated page: ${path.relative(root, file)}`);
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/id=["']header-update-time[#'][^>]*>(\d{4})年(\d{1,2})月</);
  if (!match) throw new Error(`No header-update-time in ${path.relative(root, file)}`);
  const actual = { year: Number(match[1]), month: Number(match[2]) };
  if (actual.year !== expected.year || actual.month !== expected.month) {
    throw new Error(`${path.relative(root, file)} shows ${actual.year}-${actual.month}, expected ${expected.year}-${expected.month}`);
  }
}

assertPage(path.join(root, 'index.html'), latest);

const pageSpecs = [
  ['airport/tpe/index.html', 'data/flight_data_airport-tpe.json'],
  ['airport/khh/index.html', 'data/flight_data_airport-khh.json'],
  ['airport/tsa/index.html', 'data/flight_data_airport-tsa.json'],
  ['airport/rmq/index.html', 'data/flight_data_airport-rmq.json'],
  ['airport/tnn/index.html', 'data/flight_data_airport-tnn.json'],
  ['airport/hun/index.html', 'data/flight_data_airport-hun.json'],
  ['airline/cal/index.html', 'data/flight_data_airline-cal.json'],
  ['airline/eva/index.html', 'data/flight_data_airline-eva.json'],
  ['airline/starlux/index.html', 'data/flight_data_airline-starlux.json'],
  ['airline/tiger/index.html', 'data/flight_data_airline-tiger.json'],
];

for (const [pageRel, datasetRel] of pageSpecs) {
  const datasetFile = path.join(root, datasetRel);
  if (!fs.existsSync(datasetFile)) throw new Error(`Missing dataset: ${datasetRel}`);
  const rows = JSON.parse(fs.readFileSync(datasetFile, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`Empty dataset: ${datasetRel}`);
  assertPage(path.join(root, pageRel), maxMonth(rows));
}

for (const required of ['sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt']) {
  if (!fs.existsSync(path.join(root, required))) throw new Error(`Missing generated artifact: ${required}`);
}

console.log(`Release verification passed for ${latest.year}-${String(latest.month).padStart(2, '0')} (${latestRows.length} latest-month rows).`);
