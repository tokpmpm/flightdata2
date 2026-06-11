const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'insights', '2026-taiwan-aviation-market-outlook', 'index.html');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. CSS & Layout upgrades
const oldCss = `        .toc-box {
            background: var(--color-bg-elevated);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--space-4) var(--space-5);
            margin-bottom: var(--space-8);
        }

        .toc-box h3 {
            font-size: 0.95rem;
            color: var(--color-text-primary);
            margin-bottom: var(--space-3);
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: var(--space-2);
        }

        .toc-list {
            list-style: none;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-2) var(--space-4);
        }

        @media (max-width: 768px) {
            .toc-list {
                grid-template-columns: 1fr;
            }
        }

        .toc-item a {
            color: var(--color-text-secondary);
            text-decoration: none;
            font-size: 0.85rem;
            transition: color var(--transition-fast);
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .toc-item a:hover {
            color: var(--color-primary);
        }`;

const newCss = `        .toc-box {
            background: var(--color-bg-elevated);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: var(--space-4) var(--space-5);
            margin-bottom: var(--space-8);
            max-width: 100%;
            box-sizing: border-box;
        }

        .toc-box h3 {
            font-size: 0.95rem;
            color: var(--color-text-primary);
            margin-bottom: var(--space-3);
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: var(--space-2);
        }

        .toc-list {
            list-style: none;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-2) var(--space-4);
        }

        @media (max-width: 768px) {
            .toc-list {
                grid-template-columns: 1fr;
            }
        }

        .toc-item {
            max-width: 100%;
            box-sizing: border-box;
        }

        .toc-item a {
            color: var(--color-text-secondary);
            text-decoration: none;
            font-size: 0.85rem;
            transition: color var(--transition-fast);
            display: block;
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            line-height: 1.4;
            padding: var(--space-1) 0;
        }

        .toc-item a:hover {
            color: var(--color-primary);
        }

        @media (max-width: 768px) {
            .header {
                position: static !important;
                padding: var(--space-3) 0 !important;
            }
            .hero {
                padding: var(--space-6) 0 var(--space-4) 0 !important;
            }
            .hero h1 {
                font-size: 1.5rem !important;
            }
            .insight-container {
                padding: 0 var(--space-4) !important;
            }
            .insight-block {
                padding: var(--space-4) !important;
                scroll-margin-top: 1rem !important;
            }
            .nav-link {
                min-height: 44px !important;
                padding: var(--space-3) var(--space-4) !important;
                display: flex !important;
                align-items: center !important;
            }
            .toc-item a {
                min-height: 44px !important;
                display: flex !important;
                align-items: center !important;
            }
        }`;

content = content.replace(oldCss, newCss);

// 2. Logo H2 to Div
const oldLogo = `<h2 class="logo-text" style="font-size: 1.3rem; line-height: 1.2;">台灣航空載客率數據分析</h2>`;
const newLogo = `<div class="logo-text" style="font-size: 1.3rem; line-height: 1.2; font-weight: bold; color: var(--color-text-primary);">台灣航空載客率數據分析</div>`;
content = content.replace(oldLogo, newLogo);

// 3. Title / OG Title / JSON-LD / H1 replacements
content = content.replace(
    `<title>2026 台灣航空市場洞察：載客率、熱門航點與航空公司表現完整分析 - 外勞芭 AI 招喚工坊</title>`,
    `<title>台灣航空市場累計統計與載客率分析 (2024-01 至 2026-04) - 外勞芭 AI 招喚工坊</title>`
);

content = content.replace(
    `<meta property="og:title" content="2026 台灣航空市場洞察：載客率、熱門航點與航空公司表現完整分析">`,
    `<meta property="og:title" content="台灣航空市場累計統計與載客率分析 (2024-01 至 2026-04)">`
);

content = content.replace(
    `"headline": "2026 台灣航空市場洞察：載客率、熱門航點與航空公司表現完整分析",`,
    `"headline": "台灣航空市場累計統計與載客率分析",`
);

content = content.replace(
    `<h1 id="hero-title">2026 台灣航空市場洞察：載客率、熱門航點與航空公司表現完整分析</h1>`,
    `<h1 id="hero-title">台灣航空市場累計統計與載客率分析</h1>
            <div class="period-badge" style="display: inline-block; background: #ffedd5; color: #c2410c; padding: var(--space-1.5) var(--space-3); border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; margin-top: var(--space-2); border: 1px solid rgba(194, 65, 12, 0.15); margin-bottom: var(--space-4);">統計期間：2024-01 至 2026-04；2026 年資料截至 4 月</div>`
);

// 4. Table of Contents updates
const oldToc = `            <!-- Table of Contents -->
            <nav class="toc-box" aria-label="報告目錄">
                <h3><span style="font-size: 1.1rem;">📋</span> 報告章節導覽</h3>
                <ul class="toc-list">
                    <li class="toc-item"><a href="#q1">1. 2026 年台灣航空市場是否持續成長？</a></li>
                    <li class="toc-item"><a href="#q2">2. 2025 年台灣航空市場最旺月份是哪一個月？</a></li>
                    <li class="toc-item"><a href="#q3">3. 2026 年台灣最繁忙的國際機場 is哪一座？</a></li>
                    <li class="toc-item"><a href="#q4">4. 2026 年台灣出境最熱門的國際航點 is哪一個？</a></li>
                    <li class="toc-item"><a href="#q5">5. 2026 年前 10 大熱門航點有哪些？</a></li>
                    <li class="toc-item"><a href="#q6">6. 2026 年長榮、華航、星宇、虎航四大航空公司載客率完整比較</a></li>
                    <li class="toc-item"><a href="#q7">7. 2026 年台灣國際線載客率前三大航空公司是哪些？</a></li>
                    <li class="toc-item"><a href="#q8">8. 2026 年熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？</a></li>
                    <li class="toc-item"><a href="#q9">9. 2026 年 1-4 月載客率趨勢與 2025 年同期相比如何？</a></li>
                    <li class="toc-item"><a href="#q10">10. 這份 2026 台灣航空洞察的資料來源、計算方式與更新頻率？</a></li>
                </ul>
            </nav>`;

const newToc = `            <!-- Table of Contents -->
            <nav class="toc-box" aria-label="報告目錄">
                <h3><span style="font-size: 1.1rem;">📋</span> 報告章節導覽</h3>
                <ul class="toc-list">
                    <li class="toc-item"><a href="#q1">1. 2026 年 1-4 月台灣航空市場是否持續成長？</a></li>
                    <li class="toc-item"><a href="#q2">2. 2025 全年台灣航空市場最旺月份是哪一個月？</a></li>
                    <li class="toc-item"><a href="#q3">3. 2024-01 至 2026-04 累計台灣最繁忙的國際機場是哪一座？</a></li>
                    <li class="toc-item"><a href="#q4">4. 2024-01 至 2026-04 累計台灣國際及兩岸航線熱門航點（雙向旅客量）是哪一個？</a></li>
                    <li class="toc-item"><a href="#q5">5. 2024-01 至 2026-04 累計前 10 大熱門航點有哪些？</a></li>
                    <li class="toc-item"><a href="#q6">6. 2026 年 1-4 月長榮、華航、星宇、虎航四大航空公司載客率完整比較</a></li>
                    <li class="toc-item"><a href="#q7">7. 2026 年 1-4 月台灣國際線載客率前三大航空公司是哪些？</a></li>
                    <li class="toc-item"><a href="#q8">8. 2024-01 至 2026-04 累計熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？</a></li>
                    <li class="toc-item"><a href="#q9">9. 2026 年 1-4 月載客率趨勢與 2025 年同期相比如何？</a></li>
                    <li class="toc-item"><a href="#q10">10. 這份數據分析報告的資料來源、計算方式與更新頻率？</a></li>
                </ul>
            </nav>`;

content = content.replace(oldToc, newToc);

// 5. Sections period and naming upgrades
content = content.replace(
    `<h2 itemProp="name">2026 年台灣航空市場是否持續成長？</h2>`,
    `<h2 itemProp="name">2026 年 1-4 月台灣航空市場是否持續成長？</h2>`
);

content = content.replace(
    `<h2 itemProp="name">2025 年台灣航空市場最旺月份是哪一個月？</h2>`,
    `<h2 itemProp="name">2025 全年台灣航空市場最旺月份是哪一個月？</h2>`
);

content = content.replace(
    `<h2 itemProp="name">2026 年台灣最繁忙的國際機場是哪一座？</h2>`,
    `<h2 itemProp="name">2024-01 至 2026-04 累計台灣最繁忙的國際機場是哪一座？</h2>`
);

// Q4 Outbound to International route terminology
const oldQ4Text = `<h2 itemProp="name">2026 年台灣出境最熱門的國際航點是哪一個？</h2>
                <div class="tldr" itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                    <span class="label">💡 直接答案：</span>
                    <p itemProp="text"><strong>香港以 1,469 萬人次（佔 11.0%）居冠，但載客率僅 70.5%，遠低於市場平均 80.8%。</strong></p>
                </div>
                <div class="detail" itemProp="text">
                    <p>統計期間累計旅客運量最大的單一國際航點為 <strong>香港</strong>，共錄得 <strong>14,693,713 旅客人次</strong>，佔全台總出境旅客量的 <strong>11.0%</strong>，為極具代表性的高運力黃金航線。</p>`;

const newQ4Text = `<h2 itemProp="name">2024-01 至 2026-04 累計台灣國際及兩岸航線熱門航點（雙向旅客量）是哪一個？</h2>
                <div class="tldr" itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                    <span class="label">💡 直接答案：</span>
                    <p itemProp="text"><strong>香港以 1,469 萬人次（佔 11.0%）居冠，但載客率僅 70.5%，遠低於市場平均 80.8%。</strong></p>
                </div>
                <div class="detail" itemProp="text">
                    <p>統計期間累計旅客運量最大的單一國際航點為 <strong>香港</strong>，共錄得 <strong>14,693,713 旅客人次</strong>，佔全台總旅客量的 <strong>11.0%</strong>，為極具代表性的高運力黃金航線。</p>`;

content = content.replace(oldQ4Text, newQ4Text);

// Q5 Outbound to International route terminology
const oldQ5Text = `<h2 itemProp="name">2026 年前 10 大熱門航點有哪些？</h2>
                <div class="tldr" itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                    <span class="label">💡 直接答案：</span>
                    <p itemProp="text"><strong>依序：香港(1469萬)、東京成田(947萬)、大阪(815萬)、首爾仁川(696萬)、曼谷(629萬)、新加坡(474萬)、馬尼拉(448萬)、胡志明市(427萬)、上海浦東(425萬)、沖繩(409萬)。前 4 名佔 29.3%。</strong></p>
                </div>
                <div class="detail" itemProp="text">
                    <p>下表展示了統計期間（2024-01 至 2026-04 累計）台灣出境旅客前 10 大熱門目的地航點的完整排名：</p>`;

const newQ5Text = `<h2 itemProp="name">2024-01 至 2026-04 累計前 10 大熱門航點有哪些？</h2>
                <div class="tldr" itemProp="acceptedAnswer" itemScope itemType="https://schema.org/Answer">
                    <span class="label">💡 直接答案：</span>
                    <p itemProp="text"><strong>依序：香港(1469萬)、東京成田(947萬)、大阪(815萬)、首爾仁川(696萬)、曼谷(629萬)、新加坡(474萬)、馬尼拉(448萬)、胡志明市(427萬)、上海浦東(425萬)、沖繩(409萬)。前 4 名佔 29.3%。</strong></p>
                </div>
                <div class="detail" itemProp="text">
                    <p>下表展示了統計期間（2024-01 至 2026-04 累計）台灣國際及兩岸航線前 10 大熱門目的地航點（雙向旅客量）的完整排名：</p>`;

content = content.replace(oldQ5Text, newQ5Text);

content = content.replace(
    `<h2 itemProp="name">2026 年長榮、華航、星宇、虎航四大航空公司載客率完整比較</h2>`,
    `<h2 itemProp="name">2026 年 1-4 月長榮、華航、星宇、虎航四大航空公司載客率完整比較</h2>`
);

content = content.replace(
    `<h2 itemProp="name">2026 年台灣國際線載客率前三大航空公司是哪些？</h2>`,
    `<h2 itemProp="name">2026 年 1-4 月台灣國際線載客率前三大航空公司是哪些？</h2>`
);

content = content.replace(
    `<h2 itemProp="name">2026 年熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？</h2>`,
    `<h2 itemProp="name">2024-01 至 2026-04 累計熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？</h2>`
);

content = content.replace(
    `<h2 itemProp="name">這份 2026 台灣航空洞察的資料來源、計算方式與更新頻率？</h2>`,
    `<h2 itemProp="name">這份數據分析報告的資料來源、計算方式與更新頻率？</h2>`
);

// Scatter plot label translation
content = content.replace(
    `title: { display: true, text: '累計出境旅客量 (人次)', font: { weight: 'bold' } },`,
    `title: { display: true, text: '累計旅客量 (人次)', font: { weight: 'bold' } },`
);

// 6. JSON-LD graph updates
const oldFaqGraph = `            {
              "@type": "Question",
              "name": "2026 年台灣航空市場是否持續成長？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "是。2026 年 1-4 月累計旅客量同比 2025 年同期成長 13.5%，市場持續復甦中。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2025 年台灣航空市場最旺月份是哪一個月？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2025 年 8 月最旺，載客率 82.6%；7 月 79.6% 為暑假高峰，全年平均 80.4%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年台灣最繁忙的國際機場 is哪一座？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "桃園國際機場佔 82.7% 旅客量，累計 1.1 億人次；高雄 12.3%、台中 3.1%、松山 1.9%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年台灣出境最熱門的國際航點 is哪一個？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "香港以 1,469 萬人次（佔 11.0%）居冠，但載客率僅 70.5%，遠低於市場平均 80.8%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年前 10 大熱門航點有哪些？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "依序：香港(1469萬)、東京成田(947萬)、大阪(815萬)、首爾仁川(696萬)、曼谷(629萬)、新加坡(474萬)、馬尼拉(448萬)、胡志明市(427萬)、上海浦東(425萬)、沖繩(409萬)。前 4 名佔 29.3%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年長榮、華航、星宇、虎航四大航空公司載客率完整比較",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2026 年 1-4 月累計：台灣虎航 91.98% 冠軍、星宇航空 87.37%、中華航空 86.70%、長榮航空 86.44%。長榮航空航班量最大 (20,017 班)，單班效率台灣虎航最高。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年台灣國際線載客率前三大航空公司 is哪些？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2026 年 1-4 月累計：星悅 99.57% 居冠（航班極少）。主要定期航司（航班>=100）前三名依序為：日本航空 93.83%、全日空 93.48%、韓亞航空 92.86%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "高運量低載客率：香港(1469萬、70.5%)、上海浦東(425萬、72.1%)、馬尼拉(448萬、73.6%)。雙高：大阪(815萬、85.1%)..",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年 1-4 月載客率趨勢與 2025 年同期相比如何？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2026 年呈單峰：1月 82.3%→2月 86.4%→3月 88.0%峰值→4月 84.9%。較 2025 同期各月高 2.2-9.0 個百分點（3月差距最大），1-4 月平均 85.4% vs 80.2%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "這份 2026 台灣航空洞察的資料來源、計算方式與更新頻率？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "來源：民航局開放資料。載客率＝實際旅客÷可供座位×100%。每月民航局發布後 3-5 工作天更新，最近更新 2026-04（含至 4 月數據），完整度 100%。",
                "dateCreated": "2026-06-10"
              }
            }`;

// Wait, let's verify if '台灣國際線載客率前三大航空公司 is哪些？' exists in the original file. Let's do search.
// In the original file we viewed:
// Line 162: "name": "2026 年台灣國際線載客率前三大航空公司是哪些？", (it had 是哪些, not is哪些, but let's check).
// And for Q7 in TOC: "7. 2026 年台灣國際線載客率前三大航空公司是哪些？"
// Let's replace FAQ graph nodes item by item or in a unified block. Let's write the unified block precisely.

const newFaqGraph = `            {
              "@type": "Question",
              "name": "2026 年 1-4 月台灣航空市場是否持續成長？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "是。2026 年 1-4 月累計旅客量同比 2025 年同期成長 13.5%，市場持續復甦中。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2025 全年台灣航空市場最旺月份是哪一個月？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2025 年 8 月最旺，載客率 82.6%；7 月 79.6% 為暑假高峰，全年平均 80.4%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2024-01 至 2026-04 累計台灣最繁忙的國際機場是哪一座？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "桃園國際機場佔 82.7% 旅客量，累計 1.1 億人次；高雄 12.3%、台中 3.1%、松山 1.9%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2024-01 至 2026-04 累計台灣國際及兩岸航線熱門航點（雙向旅客量）是哪一個？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "香港以 1,469 萬人次（佔 11.0%）居冠，但載客率僅 70.5%，遠低於市場平均 80.8%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2024-01 至 2026-04 累計前 10 大熱門航點有哪些？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "依序：香港(1469萬)、東京成田(947萬)、大阪(815萬)、首爾仁川(696萬)、曼谷(629萬)、新加坡(474萬)、馬尼拉(448萬)、胡志明市(427萬)、上海浦東(425萬)、沖繩(409萬)。前 4 名佔 29.3%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年 1-4 月長榮、華航、星宇、虎航四大航空公司載客率完整比較",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2026 年 1-4 月累計：台灣虎航 91.98% 冠軍、星宇航空 87.37%、中華航空 86.70%、長榮航空 86.44%。長榮航空航班量最大 (20,017 班)，單班效率台灣虎航最高。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年 1-4 月台灣國際線載客率前三大航空公司是哪些？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2026 年 1-4 月累計：星悅 99.57% 居冠（航班極少）。主要定期航司（航班>=100）前三名依序為：日本航空 93.83%、全日空 93.48%、韓亞航空 92.86%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2024-01 至 2026-04 累計熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "高運量低載客率：香港(1469萬、70.5%)、上海浦東(425萬、72.1%)、馬尼拉(448萬、73.6%)。雙高：大阪(815萬、85.1%)..",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "2026 年 1-4 月載客率趨勢與 2025 年同期相比如何？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "2026 年呈單峰：1月 82.3%→2月 86.4%→3月 88.0%峰值→4月 84.9%。較 2025 同期各月高 2.2-9.0 個百分點（3月差距最大），1-4 月平均 85.4% vs 80.2%。",
                "dateCreated": "2026-06-10"
              }
            },
            {
              "@type": "Question",
              "name": "這份數據分析報告的資料來源、計算方式與更新頻率？",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "來源：民航局開放資料。載客率＝實際旅客÷可供座位×100%。每月民航局發布後 3-5 工作天更新，最近更新 2026-04（含至 4 月數據），完整度 100%。",
                "dateCreated": "2026-06-10"
              }
            }`;

// Let's replace individual JSON FAQ segments to be safe since they are discrete and can vary by tiny spacing
content = content.replace(
  `"name": "2026 年台灣航空市場是否持續成長？"`,
  `"name": "2026 年 1-4 月台灣航空市場是否持續成長？"`
);
content = content.replace(
  `"name": "2025 年台灣航空市場最旺月份是哪一個月？"`,
  `"name": "2025 全年台灣航空市場最旺月份是哪一個月？"`
);
content = content.replace(
  `"name": "2026 年台灣最繁忙的國際機場 is哪一座？"`,
  `"name": "2024-01 至 2026-04 累計台灣最繁忙 the 國際機場是哪一座？"`
);
content = content.replace(
  `"name": "2026 年台灣最繁忙的國際機場是哪一座？"`,
  `"name": "2024-01 至 2026-04 累計台灣最繁忙 the 國際機場是哪一座？"`
);
// Make sure it doesn't leave "the" in Chinese
content = content.replace(`最繁忙 the 國際機場`, `最繁忙的國際機場`);

content = content.replace(
  `"name": "2026 年台灣出境最熱門的國際航點 is哪一個？"`,
  `"name": "2024-01 至 2026-04 累計台灣國際及兩岸航線熱門航點（雙向旅客量）是哪一個？"`
);
content = content.replace(
  `"name": "2026 年台灣出境最熱門的國際航點是哪一個？"`,
  `"name": "2024-01 至 2026-04 累計台灣國際及兩岸航線熱門航點（雙向旅客量）是哪一個？"`
);
content = content.replace(
  `"name": "2026 年前 10 大熱門航點有哪些？"`,
  `"name": "2024-01 至 2026-04 累計前 10 大熱門航點有哪些？"`
);
content = content.replace(
  `"name": "2026 年長榮、華航、星宇、虎航四大航空公司載客率完整比較"`,
  `"name": "2026 年 1-4 月長榮、華航、星宇、虎航四大航空公司載客率完整比較"`
);
content = content.replace(
  `"name": "2026 年台灣國際線載客率前三大航空公司是哪些？"`,
  `"name": "2026 年 1-4 月台灣國際線載客率前三大航空公司是哪些？"`
);
content = content.replace(
  `"name": "2026 年熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？"`,
  `"name": "2024-01 至 2026-04 累計熱門航點中，哪些「高運量」卻「低載客率」，哪些「雙高」？"`
);
content = content.replace(
  `"name": "這份 2026 台灣航空洞察的資料來源、計算方式與更新頻率？"`,
  `"name": "這份數據分析報告的資料來源、計算方式與更新頻率？"`
);

// 7. Update source checking references
content = content.replace(
    /allMatches/g, 'allMatches' // dummy
);
// Replace meta sources
content = content.replace(
    /<cite>資料來源：民航局開放資料<\/cite>/g,
    `<cite>資料來源：民航局開放資料 (最新數據：民航局115年4月)</cite>`
);

content = content.replace(
    `資料來源：交通部民用航空局「民航統計月報」 | 更新時間：2026-06-10 | 版權所有 © 2026 外勞芭. All Rights Reserved.`,
    `資料來源：交通部民用航空局「民航統計月報」 (最新數據：民航局115年4月) | 更新時間：2026-06-10 | 版權所有 © 2026 外勞芭. All Rights Reserved.`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully modified index.html!');
