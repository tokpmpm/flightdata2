/**
 * fix_insights_html.js
 * 一次性修正 insights/2026-taiwan-aviation-market-outlook/index.html
 * 以 1-5 月資料庫驗算正確值取代所有舊數字
 * 修正後此頁凍結，不再自動更新
 */
const fs = require('fs');
const path = require('path');

const htmlFilePath = path.join(__dirname, '..', 'insights', '2026-taiwan-aviation-market-outlook', 'index.html');
let html = fs.readFileSync(htmlFilePath, 'utf8');

// ═══════════════════════════════════════════════════════════════════════
// 正確數值（來自 scripts/verify_data.js 驗算，1-5 月資料庫直接計算）
// ═══════════════════════════════════════════════════════════════════════

const CORRECT = {
    // ── 全局 ──────────────────────────────────────────────────────────────
    pax2026:     '26,805,812',
    pax2025:     '23,741,345',
    flights2026: '128,974',
    flights2025: '121,262',
    seats2026:   '31,677,574',
    seats2025:   '29,839,707',
    lf2026:      '84.6%',
    lf2025:      '79.6%',
    lfDiff:      '+5.1%',
    paxGrowth:   '+12.9%',
    flightGrowth:'+6.4%',
    seatGrowth:  '+6.2%',
    // KPI cards
    kpiPax:      '26,805,812',
    kpiLf:       '84.6%',
    kpiHub:      '桃園 81.0%',
    kpiPeakLf:   '88.0%',

    // ── Q4 香港 ──────────────────────────────────────────────────────────
    hkPax:    '2,793,740',
    hkPaxWan: '279.4',
    hkShare:  '10.4%',
    hkLf:     '74.6%',
    hkSeats:  '3,745,488',  // 2793740 / 0.7457 ≈ 此欄用於 Q4 內文，直接用旅客量

    // ── Q9 機場 ──────────────────────────────────────────────────────────
    taoYuanPax:  '21,708,305',
    taoYuanShr:  '81.0%',
    taoYuanLf:   '84.6%',
    khhPax:      '2,825,938',
    khhShr:      '10.5%',
    khhLf:       '82.5%',
    tsnPax:      '1,302,884',
    tsnShr:      '4.9%',
    tsnLf:       '90.4%',
    rmnPax:      '946,731',
    rmnShr:      '3.5%',
    rmnLf:       '83.2%',

    // ── 平均載客率（用於散佈圖基準線）──────────────────────────────────
    avgLf:    '84.6',
};

// ═══════════════════════════════════════════════════════════════════════
// 1. KPI Hero Section
// ═══════════════════════════════════════════════════════════════════════
html = html.replace(/<div class="kpi-value">21,616,419<\/div>/g,
    `<div class="kpi-value">26,805,812</div>`);
html = html.replace(/<div class="kpi-value">85\.4%<\/div>/g,
    `<div class="kpi-value">84.6%</div>`);
html = html.replace(/<div class="kpi-value">桃園 81\.1%<\/div>/g,
    `<div class="kpi-value">桃園 81.0%</div>`);

// ═══════════════════════════════════════════════════════════════════════
// 2. Q1 Summary
// ═══════════════════════════════════════════════════════════════════════

// TLDR text
html = html.replace(
    /是。2026 年 1-5 月累計旅客量較 2025 年同期增加 12\.9%，航班數增加 6\.4%，可供座位數增加 6\.2%。/g,
    `是。2026 年 1-5 月累計旅客量較 2025 年同期增加 12.9%，航班數增加 6.4%，可供座位數增加 6.2%。`
);

// Q1 detail paragraph
html = html.replace(
    /根據交通部民用航空局統計，2026 年 1 至 5 月台灣國際航線累計旅客量達 <strong>26,805,812 人次<\/strong>，較 2025 年同期的 23,741,345 人次增加 <strong>12\.9%<\/strong>。同期間航班數為 <strong>128,974 班<\/strong>，較 2025 年同期成長 <strong>6\.4%<\/strong>；可供座位數為 <strong>31,677,574 席<\/strong>，成長 <strong>6\.2%<\/strong>。<\/p>\s*<p>同期間平均載客率從 2025 年同期的 <strong>79\.6%<\/strong> 提升至 <strong>84\.6%<\/strong>，增加 <strong>5\.1%<\/strong>。/g,
    `根據交通部民用航空局統計，2026 年 1 至 5 月台灣國際航線累計旅客量達 <strong>26,805,812 人次</strong>，較 2025 年同期的 23,741,345 人次增加 <strong>12.9%</strong>。同期間航班數為 <strong>128,974 班</strong>，較 2025 年同期成長 <strong>6.4%</strong>；可供座位數為 <strong>31,677,574 席</strong>，成長 <strong>6.2%</strong>。</p>
                    <p>同期間平均載客率從 2025 年同期的 <strong>79.6%</strong> 提升至 <strong>84.6%</strong>，增加 <strong>5.1%</strong>。`
);

// Q1 table: 旅客量 2025
html = html.replace(
    /<td data-label="2025 年 1-5 月">23,741,345<\/td>/g,
    `<td data-label="2025 年 1-5 月">23,741,345</td>`
);

// Q1 table: 航班數 2025 (was 96,562 which is wrong)
html = html.replace(
    /<td data-label="2025 年 1-5 月">96,562<\/td>/g,
    `<td data-label="2025 年 1-5 月">121,262</td>`
);

// Q1 table: 航班數 2026 (was 128,974 — already correct but just in case)
// Q1 table: 可供座位數 2025 (was 23,752,401 which is wrong)
html = html.replace(
    /<td data-label="2025 年 1-5 月">23,752,401<\/td>/g,
    `<td data-label="2025 年 1-5 月">29,839,707</td>`
);

// Q1 table: lf 2025 79.6% and 2026 84.6% — already correct in text but check table
html = html.replace(
    /<td data-label="2025 年 1-5 月">79\.6%<\/td>/g,
    `<td data-label="2025 年 1-5 月">79.6%</td>`
);
html = html.replace(
    /<td data-label="2026 年 1-5 月">84\.6%<\/td>/g,
    `<td data-label="2026 年 1-5 月">84.6%</td>`
);
html = html.replace(
    /<td data-label="差異">\+5\.1%<\/td>/g,
    `<td data-label="差異">+5.1%</td>`
);

// ═══════════════════════════════════════════════════════════════════════
// 3. Q3 Top-5 Growth Routes — update TLDR and table
// ═══════════════════════════════════════════════════════════════════════

// TLDR
html = html.replace(
    /前 5 名為東京成田 \+21\.9 萬、沖繩 \+20\.3 萬、釜山 \+20\.1 萬、馬尼拉 \+14\.5 萬、大阪 \+14\.0 萬人次。載客率分別增加 3\.4%、6\.3%、4\.2%、0\.2%、6\.2%。/g,
    `前 5 名為東京成田 +26.7 萬、釜山 +25.2 萬、沖繩 +24.0 萬、大阪 +16.9 萬、上海浦東 +16.3 萬人次。載客率分別增加 3.0%、2.8%、5.9%、6.7%、11.6%。`
);

// Replace Q3 entire table tbody (between thead and /table)
// The old table had columns: 排名, 航線, 2025旅客量, 2026旅客量, 增加量, 載客率變化
const oldQ3Tbody = `                            <tbody>
                                <tr>
                                    <td data-label="排名">1</td>
                                    <td data-label="航線"><strong>東京成田</strong></td>
                                    <td data-label="2025 旅客量">1,365,537</td>
                                    <td data-label="2026 旅客量">1,584,220</td>
                                    <td data-label="增加量">+218,683</td>
                                    <td data-label="載客率變化">89.7% → 93.1%（+3.4%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">2</td>
                                    <td data-label="航線"><strong>沖繩</strong></td>
                                    <td data-label="2025 旅客量">543,015</td>
                                    <td data-label="2026 旅客量">745,931</td>
                                    <td data-label="增加量">+202,916</td>
                                    <td data-label="載客率變化">83.7% → 90.1%（+6.3%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">3</td>
                                    <td data-label="航線"><strong>釜山</strong></td>
                                    <td data-label="2025 旅客量">401,927</td>
                                    <td data-label="2026 旅客量">602,783</td>
                                    <td data-label="增加量">+200,856</td>
                                    <td data-label="載客率變化">85.7% → 89.9%（+4.2%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">4</td>
                                    <td data-label="航線"><strong>馬尼拉</strong></td>
                                    <td data-label="2025 旅客量">669,374</td>
                                    <td data-label="2026 旅客量">814,610</td>
                                    <td data-label="增加量">+145,236</td>
                                    <td data-label="載客率變化">79.1% → 79.3%（+0.2%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">5</td>
                                    <td data-label="航線"><strong>大阪</strong></td>
                                    <td data-label="2025 旅客量">1,154,172</td>
                                    <td data-label="2026 旅客量">1,294,615</td>
                                    <td data-label="增加量">+140,443</td>
                                    <td data-label="載客率變化">84.5% → 90.7%（+6.2%）</td>
                                </tr>
                            </tbody>`;
const newQ3Tbody = `                            <tbody>
                                <tr>
                                    <td data-label="排名">1</td>
                                    <td data-label="航線"><strong>東京成田</strong></td>
                                    <td data-label="2025 旅客量">1,685,946</td>
                                    <td data-label="2026 旅客量">1,952,508</td>
                                    <td data-label="增加量">+266,562</td>
                                    <td data-label="載客率變化">87.8% → 90.8%（+3.0%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">2</td>
                                    <td data-label="航線"><strong>釜山</strong></td>
                                    <td data-label="2025 旅客量">500,791</td>
                                    <td data-label="2026 旅客量">752,703</td>
                                    <td data-label="增加量">+251,912</td>
                                    <td data-label="載客率變化">86.1% → 88.9%（+2.8%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">3</td>
                                    <td data-label="航線"><strong>沖繩</strong></td>
                                    <td data-label="2025 旅客量">702,887</td>
                                    <td data-label="2026 旅客量">943,082</td>
                                    <td data-label="增加量">+240,195</td>
                                    <td data-label="載客率變化">83.4% → 89.3%（+5.9%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">4</td>
                                    <td data-label="航線"><strong>大阪</strong></td>
                                    <td data-label="2025 旅客量">1,429,975</td>
                                    <td data-label="2026 旅客量">1,598,925</td>
                                    <td data-label="增加量">+168,950</td>
                                    <td data-label="載客率變化">82.9% → 89.6%（+6.7%）</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">5</td>
                                    <td data-label="航線"><strong>上海浦東</strong></td>
                                    <td data-label="2025 旅客量">732,182</td>
                                    <td data-label="2026 旅客量">895,199</td>
                                    <td data-label="增加量">+163,017</td>
                                    <td data-label="載客率變化">69.9% → 81.5%（+11.6%）</td>
                                </tr>
                            </tbody>`;
html = html.replace(oldQ3Tbody, newQ3Tbody);

// ═══════════════════════════════════════════════════════════════════════
// 4. Q4 香港
// ═══════════════════════════════════════════════════════════════════════
// TLDR
html = html.replace(
    /香港以 226\.7 萬人次（佔 10\.5%）居冠，但載客率 75\.5%，低於 2026 年 1-5 月市場平均 85\.4%。/g,
    `香港以 279.4 萬人次（佔 10.4%）居冠，但載客率 74.6%，低於 2026 年 1-5 月市場平均 84.6%。`
);
// Detail paragraphs
html = html.replace(
    /2026 年 1-5 月旅客運量最大的單一國際及兩岸航點為 <strong>香港<\/strong>，共錄得 <strong>2,267,096 旅客人次<\/strong>，佔全台總旅客量的 <strong>10\.5%<\/strong>。/g,
    `2026 年 1-5 月旅客運量最大的單一國際及兩岸航點為 <strong>香港</strong>，共錄得 <strong>2,793,740 旅客人次</strong>，佔全台總旅客量的 <strong>10.4%</strong>。`
);
html = html.replace(
    /香港航線同期間可供座位達 <strong>3,004,412 席<\/strong>，平均載客率為 <strong>75\.5%<\/strong>，比整體平均 <strong>85\.4%<\/strong> 低 <strong>9\.9%<\/strong>。/g,
    `香港航線同期間可供座位達 <strong>3,747,500 席</strong>，平均載客率為 <strong>74.6%</strong>，比整體平均 <strong>84.6%</strong> 低 <strong>10.0%</strong>。`
);

// ═══════════════════════════════════════════════════════════════════════
// 5. Q5 前10大目的地 — TLDR + detail paragraph + table + summary
// ═══════════════════════════════════════════════════════════════════════
html = html.replace(
    /依序：香港\(226\.7萬\)、東京成田\(158\.4萬\)、大阪\(129\.5萬\)、首爾仁川\(116\.4萬\)、曼谷蘇凡納布\(100\.2萬\)、馬尼拉\(81\.5萬\)、新加坡\(74\.8萬\)、沖繩\(74\.6萬\)、上海浦東\(70\.7萬\)、胡志明市\(68\.7萬\)。/g,
    `依序：香港(279.4萬)、東京成田(195.3萬)、大阪(159.9萬)、首爾仁川(142.1萬)、曼谷蘇凡納布(120.9萬)、馬尼拉(99.9萬)、沖繩(94.3萬)、新加坡(91.4萬)、上海浦東(89.5萬)、胡志明市(83.9萬)。`
);

html = html.replace(
    /下表展示 2026 年 1-5 月台灣國際及兩岸航線前 10 大熱門目的地航點（雙向旅客量）的完整排名：/g,
    `下表展示 2026 年 1-5 月台灣國際及兩岸航線前 10 大熱門目的地航點（雙向旅客量）的完整排名：`
);

// Q5 table rows
const oldQ5TableBody = `                                <tr>
                                    <td data-label="排名">1</td>
                                    <td data-label="目的地航點"><strong>香港</strong></td>
                                    <td data-label="累計旅客量">2,267,096</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 75.5%; background: linear-gradient(135deg, #ca8a04, #a16207);"></div></div><span class="color-bar-val">75.5%</span></div></td>
                                    <td data-label="佔比">10.5%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">2</td>
                                    <td data-label="目的地航點"><strong>東京成田</strong></td>
                                    <td data-label="累計旅客量">1,584,220</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 93.1%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">93.1%</span></div></td>
                                    <td data-label="佔比">7.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">3</td>
                                    <td data-label="目的地航點"><strong>大阪</strong></td>
                                    <td data-label="累計旅客量">1,294,615</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 90.7%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">90.7%</span></div></td>
                                    <td data-label="佔比">6.0%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">4</td>
                                    <td data-label="目的地航點"><strong>首爾仁川</strong></td>
                                    <td data-label="累計旅客量">1,164,117</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 92.3%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">92.3%</span></div></td>
                                    <td data-label="佔比">5.4%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">5</td>
                                    <td data-label="目的地航點"><strong>曼谷蘇凡納布</strong></td>
                                    <td data-label="累計旅客量">1,001,886</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 84.3%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">84.3%</span></div></td>
                                    <td data-label="佔比">4.6%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">6</td>
                                    <td data-label="目的地航點"><strong>馬尼拉</strong></td>
                                    <td data-label="累計旅客量">814,610</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 79.3%; background: linear-gradient(135deg, #ca8a04, #a16207);"></div></div><span class="color-bar-val">79.3%</span></div></td>
                                    <td data-label="佔比">3.8%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">7</td>
                                    <td data-label="目的地航點"><strong>新加坡</strong></td>
                                    <td data-label="累計旅客量">747,557</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 84.0%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">84.0%</span></div></td>
                                    <td data-label="佔比">3.5%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">8</td>
                                    <td data-label="目的地航點"><strong>沖繩</strong></td>
                                    <td data-label="累計旅客量">745,931</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 90.1%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">90.1%</span></div></td>
                                    <td data-label="佔比">3.5%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">9</td>
                                    <td data-label="目的地航點"><strong>上海浦東</strong></td>
                                    <td data-label="累計旅客量">706,652</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 80.9%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">80.9%</span></div></td>
                                    <td data-label="佔比">3.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">10</td>
                                    <td data-label="目的地航點"><strong>胡志明市</strong></td>
                                    <td data-label="累計旅客量">687,222</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 82.5%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">82.5%</span></div></td>
                                    <td data-label="佔比">3.2%</td>
                                </tr>`;
const newQ5TableBody = `                                <tr>
                                    <td data-label="排名">1</td>
                                    <td data-label="目的地航點"><strong>香港</strong></td>
                                    <td data-label="累計旅客量">2,793,740</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 74.6%; background: linear-gradient(135deg, #ca8a04, #a16207);"></div></div><span class="color-bar-val">74.6%</span></div></td>
                                    <td data-label="佔比">10.4%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">2</td>
                                    <td data-label="目的地航點"><strong>東京成田</strong></td>
                                    <td data-label="累計旅客量">1,952,508</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 90.8%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">90.8%</span></div></td>
                                    <td data-label="佔比">7.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">3</td>
                                    <td data-label="目的地航點"><strong>大阪</strong></td>
                                    <td data-label="累計旅客量">1,598,925</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 89.6%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">89.6%</span></div></td>
                                    <td data-label="佔比">6.0%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">4</td>
                                    <td data-label="目的地航點"><strong>首爾仁川</strong></td>
                                    <td data-label="累計旅客量">1,421,340</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 90.5%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">90.5%</span></div></td>
                                    <td data-label="佔比">5.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">5</td>
                                    <td data-label="目的地航點"><strong>曼谷蘇凡納布</strong></td>
                                    <td data-label="累計旅客量">1,208,961</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 83.2%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">83.2%</span></div></td>
                                    <td data-label="佔比">4.5%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">6</td>
                                    <td data-label="目的地航點"><strong>馬尼拉</strong></td>
                                    <td data-label="累計旅客量">998,745</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 78.3%; background: linear-gradient(135deg, #ca8a04, #a16207);"></div></div><span class="color-bar-val">78.3%</span></div></td>
                                    <td data-label="佔比">3.7%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">7</td>
                                    <td data-label="目的地航點"><strong>沖繩</strong></td>
                                    <td data-label="累計旅客量">943,082</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 89.3%; background: linear-gradient(135deg, #16a34a, #15803d);"></div></div><span class="color-bar-val">89.3%</span></div></td>
                                    <td data-label="佔比">3.5%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">8</td>
                                    <td data-label="目的地航點"><strong>新加坡</strong></td>
                                    <td data-label="累計旅客量">914,336</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 83.7%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">83.7%</span></div></td>
                                    <td data-label="佔比">3.4%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">9</td>
                                    <td data-label="目的地航點"><strong>上海浦東</strong></td>
                                    <td data-label="累計旅客量">895,199</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 81.5%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">81.5%</span></div></td>
                                    <td data-label="佔比">3.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="排名">10</td>
                                    <td data-label="目的地航點"><strong>胡志明市</strong></td>
                                    <td data-label="累計旅客量">839,266</td>
                                    <td data-label="平均載客率"><div class="color-bar-wrapper"><div class="color-bar-bg"><div class="color-bar-fill" style="width: 82.1%; background: linear-gradient(135deg, #2563eb, #1d4ed8);"></div></div><span class="color-bar-val">82.1%</span></div></td>
                                    <td data-label="佔比">3.1%</td>
                                </tr>`;
html = html.replace(oldQ5TableBody, newQ5TableBody);

// Q5 summary sentence
html = html.replace(
    /前四大熱門航線（香港、東京成田、大阪、首爾仁川）合計客運量達 <strong>6,310,048 人次<\/strong>，佔 2026 年 1-5 月全台國際線旅客量約 <strong>29\.2%<\/strong>。其中東京成田、大阪與首爾仁川的平均載客率皆超過 <strong>90%<\/strong>。/g,
    `前四大熱門航線（香港、東京成田、大阪、首爾仁川）合計客運量達 <strong>7,766,513 人次</strong>，佔 2026 年 1-5 月全台國際線旅客量約 <strong>29.0%</strong>。其中東京成田、大阪與首爾仁川的平均載客率皆超過 <strong>89%</strong>。`
);

// ═══════════════════════════════════════════════════════════════════════
// 6. Q6 四大台灣航司 — TLDR + detail paragraph + table
// ═══════════════════════════════════════════════════════════════════════
// TLDR
html = html.replace(
    /2026 年 1-5 月累計：台灣虎航載客率 91\.98% 排名第一，星宇航空 87\.37%、中華航空 86\.70%、長榮航空 86\.44%。長榮航空航班量最大 \(20,017 班\)。/g,
    `2026 年 1-5 月累計：台灣虎航載客率 91.42% 排名第一，星宇航空 86.43%、長榮航空 85.99%、中華航空 85.61%。長榮航空航班量最大 (25,106 班)。`
);

// Q6 table
const oldQ6Table = `                                <tr>
                                    <td data-label="航空公司"><strong>台灣虎航</strong></td>
                                    <td data-label="航班數">6,988</td>
                                    <td data-label="可供座位數">1,258,020</td>
                                    <td data-label="實際旅客數">1,157,086</td>
                                    <td data-label="載客率"><strong>91.98%</strong></td>
                                    <td data-label="四大航市佔率">9.50%</td>
                                </tr>
                                <tr>
                                    <td data-label="航空公司"><strong>星宇航空</strong></td>
                                    <td data-label="航班數">9,290</td>
                                    <td data-label="可供座位數">2,261,538</td>
                                    <td data-label="實際旅客數">1,975,939</td>
                                    <td data-label="載客率"><strong>87.37%</strong></td>
                                    <td data-label="四大航市佔率">16.22%</td>
                                </tr>
                                <tr>
                                    <td data-label="航空公司"><strong>中華航空</strong></td>
                                    <td data-label="航班數">18,941</td>
                                    <td data-label="可供座位數">4,711,984</td>
                                    <td data-label="實際旅客數">4,085,376</td>
                                    <td data-label="載客率"><strong>86.70%</strong></td>
                                    <td data-label="四大航市佔率">33.53%</td>
                                </tr>
                                <tr>
                                    <td data-label="航空公司"><strong>長榮航空</strong></td>
                                    <td data-label="航班數">20,017</td>
                                    <td data-label="可供座位數">5,744,163</td>
                                    <td data-label="實際旅客數">4,965,174</td>
                                    <td data-label="載客率"><strong>86.44%</strong></td>
                                    <td data-label="四大航市佔率">40.75%</td>
                                </tr>`;
// 四大航市佔率是相對四大的佔比：計算如下
// 四大總旅客 = 6205921+5058495+2493601+1446708 = 15204725
// 虎 = 1446708/15204725 = 9.51%
// 宇 = 2493601/15204725 = 16.40%
// 華 = 5058495/15204725 = 33.27%
// 榮 = 6205921/15204725 = 40.82%
const newQ6Table = `                                <tr>
                                    <td data-label="航空公司"><strong>台灣虎航</strong></td>
                                    <td data-label="航班數">8,791</td>
                                    <td data-label="可供座位數">1,582,560</td>
                                    <td data-label="實際旅客數">1,446,708</td>
                                    <td data-label="載客率"><strong>91.42%</strong></td>
                                    <td data-label="四大航市佔率">9.51%</td>
                                </tr>
                                <tr>
                                    <td data-label="航空公司"><strong>星宇航空</strong></td>
                                    <td data-label="航班數">11,789</td>
                                    <td data-label="可供座位數">2,884,958</td>
                                    <td data-label="實際旅客數">2,493,601</td>
                                    <td data-label="載客率"><strong>86.43%</strong></td>
                                    <td data-label="四大航市佔率">16.40%</td>
                                </tr>
                                <tr>
                                    <td data-label="航空公司"><strong>中華航空</strong></td>
                                    <td data-label="航班數">23,755</td>
                                    <td data-label="可供座位數">5,909,070</td>
                                    <td data-label="實際旅客數">5,058,495</td>
                                    <td data-label="載客率"><strong>85.61%</strong></td>
                                    <td data-label="四大航市佔率">33.27%</td>
                                </tr>
                                <tr>
                                    <td data-label="航空公司"><strong>長榮航空</strong></td>
                                    <td data-label="航班數">25,106</td>
                                    <td data-label="可供座位數">7,216,850</td>
                                    <td data-label="實際旅客數">6,205,921</td>
                                    <td data-label="載客率"><strong>85.99%</strong></td>
                                    <td data-label="四大航市佔率">40.82%</td>
                                </tr>`;
html = html.replace(oldQ6Table, newQ6Table);

// Q6 summary paragraph
html = html.replace(
    /長榮航空航班數 <strong>20,017 班<\/strong>、旅客量 <strong>4,965,174 人次<\/strong>，在四大本土航司中旅客份額為 <strong>40\.75%<\/strong>。台灣虎航載客率 <strong>91\.98%<\/strong>，比星宇高 <strong>4\.61%<\/strong>、比華航高 <strong>5\.28%<\/strong>、比長榮高 <strong>5\.54%<\/strong>。/g,
    `長榮航空航班數 <strong>25,106 班</strong>、旅客量 <strong>6,205,921 人次</strong>，在四大本土航司中旅客份額為 <strong>40.82%</strong>。台灣虎航載客率 <strong>91.42%</strong>，比星宇高 <strong>4.99%</strong>、比華航高 <strong>5.81%</strong>、比長榮高 <strong>5.43%</strong>。`
);

// ═══════════════════════════════════════════════════════════════════════
// 7. Q7 外籍航司 LF — TLDR text
// ═══════════════════════════════════════════════════════════════════════
html = html.replace(
    /2026 年 1-5 月累計：星悅航空 99\.57% 居冠（僅 14 班）。在航班數大於 100 班的定期主要航空公司中，前三名依序為：日本航空 93\.83%、全日空 93\.48% 與韓亞航空 92\.86%。/g,
    `2026 年 1-5 月累計：星悅航空 99.57% 居冠（僅 14 班）。在航班數大於 125 班的定期主要航空公司中，台灣虎航 91.42% 排名第一，其次為樂桃 90.33%、酷航 87.60%。`
);
// Q7 detail paragraphs
html = html.replace(
    /若篩選<strong>航班數 &gt;= 100 班<\/strong>的航空公司，載客率前三名依序為：<strong>日本航空 \(93\.83%\)<\/strong>、<strong>全日空 \(93\.48%\)<\/strong> 以及 <strong>韓亞航空 \(92\.86%\)<\/strong>。台灣虎航為 <strong>91\.98%<\/strong>，排名第四。/g,
    `若篩選<strong>航班數 &gt;= 125 班</strong>的航空公司，在非台灣籍航司中，載客率前三名依序為：<strong>全日空 (92.66%)</strong>、<strong>樂桃 (90.33%)</strong> 以及 <strong>酷航 (87.60%)</strong>。台灣虎航為 <strong>91.42%</strong>，位居全體之首。`
);

// ═══════════════════════════════════════════════════════════════════════
// 8. Q8 四象限 TLDR + detail list
// ═══════════════════════════════════════════════════════════════════════
html = html.replace(
    /高運量低載客率：香港\(226\.7萬、75\.5%\)、馬尼拉\(81\.5萬、79\.3%\)、上海浦東\(70\.7萬、80\.9%\)。雙高：東京成田\(158\.4萬、93\.1%\)、大阪\(129\.5萬、90\.7%\)、首爾仁川\(116\.4萬、92\.3%\)。高載客率中運量：沖繩\(74\.6萬、90\.1%\)。/g,
    `高運量低載客率：香港(279.4萬、74.6%)、馬尼拉(99.9萬、78.3%)、上海浦東(89.5萬、81.5%)。雙高：東京成田(195.3萬、90.8%)、大阪(159.9萬、89.6%)、首爾仁川(142.1萬、90.5%)。高載客率中運量：沖繩(94.3萬、89.3%)。`
);
// Q8 detail list items
html = html.replace(
    /<strong>高運量且高於平均載客率<\/strong>：<strong>東京成田<\/strong>（158\.4萬，93\.1%）、<strong>大阪<\/strong>（129\.5萬，90\.7%）以及 <strong>首爾仁川<\/strong>（116\.4萬，92\.3%）。/g,
    `<strong>高運量且高於平均載客率</strong>：<strong>東京成田</strong>（195.3萬，90.8%）、<strong>大阪</strong>（159.9萬，89.6%）以及 <strong>首爾仁川</strong>（142.1萬，90.5%）。`
);
html = html.replace(
    /<strong>高運量但低於平均載客率<\/strong>：<strong>香港<\/strong>（226\.7萬，75\.5%）、<strong>馬尼拉<\/strong>（81\.5萬，79\.3%）與 <strong>上海浦東<\/strong>（70\.7萬，80\.9%）。/g,
    `<strong>高運量但低於平均載客率</strong>：<strong>香港</strong>（279.4萬，74.6%）、<strong>馬尼拉</strong>（99.9萬，78.3%）與 <strong>上海浦東</strong>（89.5萬，81.5%）。`
);
html = html.replace(
    /<strong>低於 100 萬人次但高於平均載客率<\/strong>：<strong>沖繩<\/strong>（74\.6萬，90\.1%）。/g,
    `<strong>低於 100 萬人次但高於平均載客率</strong>：<strong>沖繩</strong>（94.3萬，89.3%）。`
);

// ═══════════════════════════════════════════════════════════════════════
// 9. Q9 機場
// ═══════════════════════════════════════════════════════════════════════
html = html.replace(
    /桃園 1753\.3 萬人次、佔 81\.1%；高雄 228\.2 萬人次、佔 10\.6%；臺北松山 104\.2 萬人次、佔 4\.8%；臺中清泉崗 74\.4 萬人次、佔 3\.4%。/g,
    `桃園 2170.8 萬人次、佔 81.0%；高雄 282.6 萬人次、佔 10.5%；臺北松山 130.3 萬人次、佔 4.9%；臺中清泉崗 94.7 萬人次、佔 3.5%。`
);
// Q9 table
const oldQ9Table = `                                <tr>
                                    <td data-label="機場"><strong>桃園國際機場</strong></td>
                                    <td data-label="旅客量">17,532,728</td>
                                    <td data-label="佔比">81.1%</td>
                                    <td data-label="平均載客率">85.4%</td>
                                </tr>
                                <tr>
                                    <td data-label="機場"><strong>高雄國際機場</strong></td>
                                    <td data-label="旅客量">2,281,592</td>
                                    <td data-label="佔比">10.6%</td>
                                    <td data-label="平均載客率">83.6%</td>
                                </tr>
                                <tr>
                                    <td data-label="機場"><strong>臺北松山機場</strong></td>
                                    <td data-label="旅客量">1,041,743</td>
                                    <td data-label="佔比">4.8%</td>
                                    <td data-label="平均載客率">91.0%</td>
                                </tr>
                                <tr>
                                    <td data-label="機場"><strong>臺中清泉崗機場</strong></td>
                                    <td data-label="旅客量">744,346</td>
                                    <td data-label="佔比">3.4%</td>
                                    <td data-label="平均載客率">84.1%</td>
                                </tr>`;
const newQ9Table = `                                <tr>
                                    <td data-label="機場"><strong>桃園國際機場</strong></td>
                                    <td data-label="旅客量">21,708,305</td>
                                    <td data-label="佔比">81.0%</td>
                                    <td data-label="平均載客率">84.6%</td>
                                </tr>
                                <tr>
                                    <td data-label="機場"><strong>高雄國際機場</strong></td>
                                    <td data-label="旅客量">2,825,938</td>
                                    <td data-label="佔比">10.5%</td>
                                    <td data-label="平均載客率">82.5%</td>
                                </tr>
                                <tr>
                                    <td data-label="機場"><strong>臺北松山機場</strong></td>
                                    <td data-label="旅客量">1,302,884</td>
                                    <td data-label="佔比">4.9%</td>
                                    <td data-label="平均載客率">90.4%</td>
                                </tr>
                                <tr>
                                    <td data-label="機場"><strong>臺中清泉崗機場</strong></td>
                                    <td data-label="旅客量">946,731</td>
                                    <td data-label="佔比">3.5%</td>
                                    <td data-label="平均載客率">83.2%</td>
                                </tr>`;
html = html.replace(oldQ9Table, newQ9Table);

// ═══════════════════════════════════════════════════════════════════════
// 10. Q10 最高/最低 LF 表格 + TLDR
// ═══════════════════════════════════════════════════════════════════════
// avg LF reference in text
html = html.replace(
    /下圖依前 10 大熱門航點的平均載客率排序，虛線為 2026 年 1-5 月整體平均載客率 <strong>85\.4%<\/strong>。/g,
    `下圖依前 10 大熱門航點的平均載客率排序，虛線為 2026 年 1-5 月整體平均載客率 <strong>84.6%</strong>。`
);
// TLDR
html = html.replace(
    /前 10 大熱門航點中，載客率最高為東京成田 93\.1%、首爾仁川 92\.3%、大阪 90\.7%；最低為香港 75\.5%、馬尼拉 79\.3%、上海浦東 80\.9%。/g,
    `前 10 大熱門航點中，載客率最高為東京成田 90.8%、首爾仁川 90.5%、大阪 89.6%；最低為香港 74.6%、馬尼拉 78.3%、上海浦東 81.5%。`
);
// Q10 table
const oldQ10Table = `                                <tr>
                                    <td data-label="組別"><strong>最高</strong></td>
                                    <td data-label="航點">東京成田</td>
                                    <td data-label="旅客量">1,584,220</td>
                                    <td data-label="平均載客率">93.1%</td>
                                    <td data-label="與整體平均差距">+7.7%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最高</strong></td>
                                    <td data-label="航點">首爾仁川</td>
                                    <td data-label="旅客量">1,164,117</td>
                                    <td data-label="平均載客率">92.3%</td>
                                    <td data-label="與整體平均差距">+6.9%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最高</strong></td>
                                    <td data-label="航點">大阪</td>
                                    <td data-label="旅客量">1,294,615</td>
                                    <td data-label="平均載客率">90.7%</td>
                                    <td data-label="與整體平均差距">+5.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最低</strong></td>
                                    <td data-label="航點">香港</td>
                                    <td data-label="旅客量">2,267,096</td>
                                    <td data-label="平均載客率">75.5%</td>
                                    <td data-label="與整體平均差距">-9.9%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最低</strong></td>
                                    <td data-label="航點">馬尼拉</td>
                                    <td data-label="旅客量">814,610</td>
                                    <td data-label="平均載客率">79.3%</td>
                                    <td data-label="與整體平均差距">-6.1%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最低</strong></td>
                                    <td data-label="航點">上海浦東</td>
                                    <td data-label="旅客量">706,652</td>
                                    <td data-label="平均載客率">80.9%</td>
                                    <td data-label="與整體平均差距">-4.5%</td>
                                </tr>`;
const newQ10Table = `                                <tr>
                                    <td data-label="組別"><strong>最高</strong></td>
                                    <td data-label="航點">東京成田</td>
                                    <td data-label="旅客量">1,952,508</td>
                                    <td data-label="平均載客率">90.8%</td>
                                    <td data-label="與整體平均差距">+6.2%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最高</strong></td>
                                    <td data-label="航點">首爾仁川</td>
                                    <td data-label="旅客量">1,421,340</td>
                                    <td data-label="平均載客率">90.5%</td>
                                    <td data-label="與整體平均差距">+5.9%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最高</strong></td>
                                    <td data-label="航點">大阪</td>
                                    <td data-label="旅客量">1,598,925</td>
                                    <td data-label="平均載客率">89.6%</td>
                                    <td data-label="與整體平均差距">+5.0%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最低</strong></td>
                                    <td data-label="航點">香港</td>
                                    <td data-label="旅客量">2,793,740</td>
                                    <td data-label="平均載客率">74.6%</td>
                                    <td data-label="與整體平均差距">-10.0%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最低</strong></td>
                                    <td data-label="航點">馬尼拉</td>
                                    <td data-label="旅客量">998,745</td>
                                    <td data-label="平均載客率">78.3%</td>
                                    <td data-label="與整體平均差距">-6.3%</td>
                                </tr>
                                <tr>
                                    <td data-label="組別"><strong>最低</strong></td>
                                    <td data-label="航點">上海浦東</td>
                                    <td data-label="旅客量">895,199</td>
                                    <td data-label="平均載客率">81.5%</td>
                                    <td data-label="與整體平均差距">-3.1%</td>
                                </tr>`;
html = html.replace(oldQ10Table, newQ10Table);

// ═══════════════════════════════════════════════════════════════════════
// 11. Q11 - 修正殘留的 1-4月 字串
// ═══════════════════════════════════════════════════════════════════════
html = html.replace(
    /本頁使用的統計期間為 2026 年 1 月至 2026 年 4 月；比較區間為 2025 年 1 月至 2025 年 4 月。/g,
    `本頁使用的統計期間為 2026 年 1 月至 2026 年 5 月；比較區間為 2025 年 1 月至 2025 年 5 月。`
);

// ═══════════════════════════════════════════════════════════════════════
// 12. Chart JS data arrays — update all with correct 1-5 month values
// ═══════════════════════════════════════════════════════════════════════

// routeData (Q8 quadrant chart) — 前10大目的地 {x: passengers, y: lf}
html = html.replace(/const routeData = \[[^]*?\];/g,
`const routeData = [
                { x: 2793740, y: 74.6, label: '香港' },
                { x: 1952508, y: 90.8, label: '東京成田' },
                { x: 1598925, y: 89.6, label: '大阪' },
                { x: 1421340, y: 90.5, label: '首爾仁川' },
                { x: 1208961, y: 83.2, label: '曼谷蘇凡納布' },
                { x: 998745, y: 78.3, label: '馬尼拉' },
                { x: 943082, y: 89.3, label: '沖繩' },
                { x: 914336, y: 83.7, label: '新加坡' },
                { x: 895199, y: 81.5, label: '上海浦東' },
                { x: 839266, y: 82.1, label: '胡志明市' }
            ];`);

// routeGrowthData (Q3 bar chart)
html = html.replace(/const routeGrowthData = \[[^]*?\];/g,
`const routeGrowthData = [
                { label: '東京成田', pax2025: 1685946, pax2026: 1952508, diff: 266562, lf2025: 87.8, lf2026: 90.8, lfDiff: 3.0 },
                { label: '釜山', pax2025: 500791, pax2026: 752703, diff: 251912, lf2025: 86.1, lf2026: 88.9, lfDiff: 2.8 },
                { label: '沖繩', pax2025: 702887, pax2026: 943082, diff: 240195, lf2025: 83.4, lf2026: 89.3, lfDiff: 5.9 },
                { label: '大阪', pax2025: 1429975, pax2026: 1598925, diff: 168950, lf2025: 82.9, lf2026: 89.6, lfDiff: 6.7 },
                { label: '上海浦東', pax2025: 732182, pax2026: 895199, diff: 163017, lf2025: 69.9, lf2026: 81.5, lfDiff: 11.6 }
            ];`);

// airportData (Q9 pie chart)
html = html.replace(/const airportData = \[[^]*?\];/g,
`const airportData = [
                { label: '桃園', passengers: 21708305, share: 81.0, loadFactor: 84.6 },
                { label: '高雄', passengers: 2825938, share: 10.5, loadFactor: 82.5 },
                { label: '松山', passengers: 1302884, share: 4.9, loadFactor: 90.4 },
                { label: '台中', passengers: 946731, share: 3.5, loadFactor: 83.2 },
                { label: '台南', passengers: 21715, share: 0.1, loadFactor: 87.4 }
            ];`);

// routeLoadData (Q10 bar chart)
html = html.replace(/const routeLoadData = \[[^]*?\];/g,
`const routeLoadData = [
                { label: '香港', passengers: 2793740, loadFactor: 74.6 },
                { label: '東京成田', passengers: 1952508, loadFactor: 90.8 },
                { label: '大阪', passengers: 1598925, loadFactor: 89.6 },
                { label: '首爾仁川', passengers: 1421340, loadFactor: 90.5 },
                { label: '曼谷蘇凡納布', passengers: 1208961, loadFactor: 83.2 },
                { label: '馬尼拉', passengers: 998745, loadFactor: 78.3 },
                { label: '沖繩', passengers: 943082, loadFactor: 89.3 },
                { label: '新加坡', passengers: 914336, loadFactor: 83.7 },
                { label: '上海浦東', passengers: 895199, loadFactor: 81.5 },
                { label: '胡志明市', passengers: 839266, loadFactor: 82.1 }
            ];`);

// Average LF reference line in quadrant chart
html = html.replace(/const avgX = x\.getPixelForValue\(85\.4\);/g,
    `const avgX = x.getPixelForValue(84.6);`);
html = html.replace(/ctx\.fillText\('平均 85\.4%', avgX \+ 6, top \+ 12\);/g,
    `ctx.fillText('平均 84.6%', avgX + 6, top + 12);`);
html = html.replace(/const diff = \(item\.loadFactor - 85\.4\)\.toFixed\(1\);/g,
    `const diff = (item.loadFactor - 84.6).toFixed(1);`);
html = html.replace(/item\.loadFactor >= 85\.4 \? '#16a34a' : '#ca8a04'/g,
    `item.loadFactor >= 84.6 ? '#16a34a' : '#ca8a04'`);

// ═══════════════════════════════════════════════════════════════════════
// 13. 寫入檔案
// ═══════════════════════════════════════════════════════════════════════
fs.writeFileSync(htmlFilePath, html, 'utf8');
console.log('✅ Insights HTML 已修正完成（所有數值更新為 1-5 月正確數據）');
