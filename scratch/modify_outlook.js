const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'insights', '2026-taiwan-aviation-market-outlook', 'index.html');
const content = fs.readFileSync(filePath, 'utf-8');

const required = [
    '2026 年 1-4 月台灣航空市場洞察與載客率分析',
    '統計期間：2026-01 至 2026-04；比較基準：2025 年同期',
    '資料來源：交通部民用航空局',
    'temporalCoverage": "2026-01/2026-04',
    '21,616,419',
    '2,267,096',
    '東京成田(158.4萬、93.1%)'
];

const forbidden = [
    '2024-01 至 2026-04',
    '2024-01/2026-04',
    'AI Overview',
    '民航統計月報',
    '115 年 4 月月報原始資料',
    '115年4月',
    'extracted/115年4月.xls',
    '官方開放資料列表頁',
    '完整度 100%',
    '3-5 工作天',
    '2025 全年台灣航空市場最旺月份'
];

const missing = required.filter(token => !content.includes(token));
const leftovers = forbidden.filter(token => content.includes(token));

const q6Count = (content.match(/<section id="q6"/g) || []).length;
if (q6Count !== 1) {
    throw new Error(`Expected exactly one Q6 section, found ${q6Count}.`);
}

if (missing.length || leftovers.length) {
    throw new Error([
        missing.length ? `Missing required 2026 1-4 scope markers: ${missing.join(', ')}` : '',
        leftovers.length ? `Found stale or disallowed strings: ${leftovers.join(', ')}` : ''
    ].filter(Boolean).join('\n'));
}

console.log('Outlook report is already scoped to 2026-01 through 2026-04.');
