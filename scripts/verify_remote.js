const fs = require('fs');
const path = require('path');

const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
const expectedYear = Number(process.env.EXPECTED_YEAR);
const expectedMonth = Number(process.env.EXPECTED_MONTH);
if (!baseUrl || !expectedYear || !expectedMonth) throw new Error('BASE_URL, EXPECTED_YEAR and EXPECTED_MONTH are required');

const root = path.resolve(__dirname, '..');
function maxMonthFromFile(rel) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  return rows.reduce((best, r) => {
    const year=Number(r.year), month=Number(r.month), key=year*100+month;
    return key > best.key ? {key,year,month} : best;
  }, {key:0,year:0,month:0});
}

const checks = [
  ['/', {year: expectedYear, month: expectedMonth}],
  ['/airport/tpe/', maxMonthFromFile('data/flight_data_airport-tpe.json')],
  ['/airport/khh/', maxMonthFromFile('data/flight_data_airport-khh.json')],
  ['/airport/tsa/', maxMonthFromFile('data/flight_data_airport-tsa.json')],
  ['/airport/rmq/', maxMonthFromFile('data/flight_data_airport-rmq.json')],
  ['/airport/tnn/', maxMonthFromFile('data/flight_data_airport-tnn.json')],
  ['/airport/hun/', maxMonthFromFile('data/flight_data_airport-hun.json')],
  ['/airline/cal/', maxMonthFromFile('data/flight_data_airline-cal.json')],
  ['/airline/eva/', maxMonthFromFile('data/flight_data_airline-eva.json')],
  ['/airline/starlux/', maxMonthFromFile('data/flight_data_airline-starlux.json')],
  ['/airline/tiger/', maxMonthFromFile('data/flight_data_airline-tiger.json')],
];

async function getWithRetry(url, attempts=12) {
  let last;
  for (let i=0; i<attempts; i++) {
    try {
      const res = await fetch(url, {redirect:'follow', headers:{'user-agent':'flightdata2-release-check/1.0'}});
      const text = await res.text();
      if (res.ok) return {res, text};
      last = new Error(`${url}: HTTP ${res.status}`);
    } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 10000));
  }
  throw last || new Error(`Failed to fetch ${url}`);
}

(async () => {
  for (const [route, expected] of checks) {
    const url = baseUrl + route;
    const {text} = await getWithRetry(url);
    const match = text.match(/id=["']header-update-time["'][^>]*>(\d{4})年(\d{1,2})月</);
    if (!match) throw new Error(`No update month found at ${url}`);
    const actual = {year:Number(match[1]), month:Number(match[2])};
    if (actual.year !== expected.year || actual.month !== expected.month) {
      throw new Error(`${url} shows ${actual.year}-${actual.month}; expected ${expected.year}-${expected.month}`);
    }
    console.log(`OK ${route} -> ${actual.year}-${String(actual.month).padStart(2,'0')}`);
  }
  const dataRes = await getWithRetry(baseUrl + '/data/flight_data_all.json');
  const remoteData = JSON.parse(dataRes.text);
  const latest = remoteData.reduce((b,r)=>Number(r.year)*100+Number(r.month)>b.key?{key:Number(r.year)*100+Number(r.month),year:Number(r.year),month:Number(r.month)}:b,{key:0,year:0,month:0});
  if (latest.year !== expectedYear || latest.month !== expectedMonth) throw new Error(`Remote dataset latest ${latest.year}-${latest.month} != expected ${expectedYear}-${expectedMonth}`);
  console.log(`Remote verification passed: ${baseUrl} -> ${expectedYear}-${String(expectedMonth).padStart(2,'0')}`);
})().catch(err => { console.error(err); process.exit(1); });
