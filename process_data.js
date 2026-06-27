const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const sourceDir = path.join(__dirname, 'extracted');
const outputFile = path.join(__dirname, 'data', 'flight_data_new.js');

// Helper to convert ROC year to AD
function parseDateFromFilename(filename) {
    // Format: 113年7月.xls
    const match = filename.match(/(\d+)年(\d+)月/);
    if (match) {
        const year = parseInt(match[1]) + 1911;
        const month = parseInt(match[2]);
        return { year, month };
    }
    return null;
}

// Destination Categorization Map
const DESTINATION_MAP = {
    // Northeast Asia
    "東京": { region: "東北亞", country: "日本" },
    "東京成田": { region: "東北亞", country: "日本" },
    "東京羽田": { region: "東北亞", country: "日本" },
    "大阪": { region: "東北亞", country: "日本" },
    "福岡": { region: "東北亞", country: "日本" },
    "名古屋": { region: "東北亞", country: "日本" },
    "沖繩": { region: "東北亞", country: "日本" },
    "琉球": { region: "東北亞", country: "日本" }, // Okinawa
    "札幌": { region: "東北亞", country: "日本" },
    "函館": { region: "東北亞", country: "日本" },
    "仙台": { region: "東北亞", country: "日本" },
    "熊本": { region: "東北亞", country: "日本" },
    "高松": { region: "東北亞", country: "日本" },
    "廣島": { region: "東北亞", country: "日本" },
    "新潟": { region: "東北亞", country: "日本" },
    "富山": { region: "東北亞", country: "日本" },
    "小松": { region: "東北亞", country: "日本" },
    "宮崎": { region: "東北亞", country: "日本" },
    "鹿兒島": { region: "東北亞", country: "日本" },
    "長崎": { region: "東北亞", country: "日本" },
    "松山": { region: "東北亞", country: "日本" }, // Matsuyama, Japan
    "靜岡": { region: "東北亞", country: "日本" },
    "岡山": { region: "東北亞", country: "日本" },
    "佐賀": { region: "東北亞", country: "日本" },
    "大分": { region: "東北亞", country: "日本" },
    "旭川": { region: "東北亞", country: "日本" },
    "秋田": { region: "東北亞", country: "日本" },
    "花卷": { region: "東北亞", country: "日本" },
    "茨城": { region: "東北亞", country: "日本" },
    "北九州": { region: "東北亞", country: "日本" },
    "石垣島": { region: "東北亞", country: "日本" },
    "下地島": { region: "東北亞", country: "日本" },
    "神戶": { region: "東北亞", country: "日本" },
    "福島": { region: "東北亞", country: "日本" },
    "米子": { region: "東北亞", country: "日本" },
    "青森": { region: "東北亞", country: "日本" },
    "高知": { region: "東北亞", country: "日本" },

    "首爾": { region: "東北亞", country: "韓國" },
    "首爾仁川": { region: "東北亞", country: "韓國" },
    "首爾金浦": { region: "東北亞", country: "韓國" },
    "釜山": { region: "東北亞", country: "韓國" },
    "濟州": { region: "東北亞", country: "韓國" },
    "大邱": { region: "東北亞", country: "韓國" },
    "清州": { region: "東北亞", country: "韓國" },
    "務安": { region: "東北亞", country: "韓國" },
    "襄陽": { region: "東北亞", country: "韓國" },

    // Southeast Asia
    "香港": { region: "港澳大陸", country: "香港" },
    "澳門": { region: "港澳大陸", country: "澳門" },
    "上海": { region: "港澳大陸", country: "中國大陸" },
    "上海浦東": { region: "港澳大陸", country: "中國大陸" },
    "上海虹橋": { region: "港澳大陸", country: "中國大陸" },
    "北京": { region: "港澳大陸", country: "中國大陸" },
    "廣州": { region: "港澳大陸", country: "中國大陸" },
    "深圳": { region: "港澳大陸", country: "中國大陸" },
    "廈門": { region: "港澳大陸", country: "中國大陸" },
    "成都": { region: "港澳大陸", country: "中國大陸" },
    "成都天府": { region: "港澳大陸", country: "中國大陸" },
    "福州": { region: "港澳大陸", country: "中國大陸" },
    "杭州": { region: "港澳大陸", country: "中國大陸" },
    "南京": { region: "港澳大陸", country: "中國大陸" },
    "寧波": { region: "港澳大陸", country: "中國大陸" },
    "武漢": { region: "港澳大陸", country: "中國大陸" },
    "重慶": { region: "港澳大陸", country: "中國大陸" },
    "天津": { region: "港澳大陸", country: "中國大陸" },
    "青島": { region: "港澳大陸", country: "中國大陸" },
    "大連": { region: "港澳大陸", country: "中國大陸" },
    "無錫": { region: "港澳大陸", country: "中國大陸" },
    "溫州": { region: "港澳大陸", country: "中國大陸" },
    "昆明": { region: "港澳大陸", country: "中國大陸" },
    "西安": { region: "港澳大陸", country: "中國大陸" },
    "長沙": { region: "港澳大陸", country: "中國大陸" },
    "鄭州": { region: "港澳大陸", country: "中國大陸" },
    "瀋陽": { region: "港澳大陸", country: "中國大陸" },
    "海口": { region: "港澳大陸", country: "中國大陸" },
    "三亞": { region: "港澳大陸", country: "中國大陸" },
    "南寧": { region: "港澳大陸", country: "中國大陸" },
    "桂林": { region: "港澳大陸", country: "中國大陸" },
    "煙台": { region: "港澳大陸", country: "中國大陸" },
    "濟南": { region: "港澳大陸", country: "中國大陸" },
    "合肥": { region: "港澳大陸", country: "中國大陸" },
    "南昌": { region: "港澳大陸", country: "中國大陸" },
    "長春": { region: "港澳大陸", country: "中國大陸" },
    "哈爾濱": { region: "港澳大陸", country: "中國大陸" },
    "太原": { region: "港澳大陸", country: "中國大陸" },
    "蘭州": { region: "港澳大陸", country: "中國大陸" },
    "貴陽": { region: "港澳大陸", country: "中國大陸" },
    "石家莊": { region: "港澳大陸", country: "中國大陸" },
    "呼和浩特": { region: "港澳大陸", country: "中國大陸" },
    "烏魯木齊": { region: "港澳大陸", country: "中國大陸" },
    "銀川": { region: "港澳大陸", country: "中國大陸" },
    "西寧": { region: "港澳大陸", country: "中國大陸" },
    "麗江": { region: "港澳大陸", country: "中國大陸" },
    "張家界": { region: "港澳大陸", country: "中國大陸" },
    "泉州": { region: "港澳大陸", country: "中國大陸" },
    "揭陽": { region: "港澳大陸", country: "中國大陸" },
    "鹽城": { region: "港澳大陸", country: "中國大陸" },
    "徐州": { region: "港澳大陸", country: "中國大陸" },
    "常州": { region: "港澳大陸", country: "中國大陸" },
    "南通": { region: "港澳大陸", country: "中國大陸" },
    "揚州": { region: "港澳大陸", country: "中國大陸" },
    "義烏": { region: "港澳大陸", country: "中國大陸" },
    "黃山": { region: "港澳大陸", country: "中國大陸" },
    "舟山": { region: "港澳大陸", country: "中國大陸" },
    "武夷山": { region: "港澳大陸", country: "中國大陸" },
    "梅州": { region: "港澳大陸", country: "中國大陸" },
    "湛江": { region: "港澳大陸", country: "中國大陸" },
    "北海": { region: "港澳大陸", country: "中國大陸" },
    "柳州": { region: "港澳大陸", country: "中國大陸" },
    "洛陽": { region: "港澳大陸", country: "中國大陸" },
    "運城": { region: "港澳大陸", country: "中國大陸" },
    "大同": { region: "港澳大陸", country: "中國大陸" },
    "延吉": { region: "港澳大陸", country: "中國大陸" },
    "牡丹江": { region: "港澳大陸", country: "中國大陸" },
    "佳木斯": { region: "港澳大陸", country: "中國大陸" },
    "海拉爾": { region: "港澳大陸", country: "中國大陸" },
    "滿洲里": { region: "港澳大陸", country: "中國大陸" },
    "包頭": { region: "港澳大陸", country: "中國大陸" },
    "鄂爾多斯": { region: "港澳大陸", country: "中國大陸" },
    "拉薩": { region: "港澳大陸", country: "中國大陸" },
    "喀什": { region: "港澳大陸", country: "中國大陸" },
    "庫爾勒": { region: "港澳大陸", country: "中國大陸" },
    "伊寧": { region: "港澳大陸", country: "中國大陸" },
    "阿克蘇": { region: "港澳大陸", country: "中國大陸" },
    "和田": { region: "港澳大陸", country: "中國大陸" },
    "哈密": { region: "港澳大陸", country: "中國大陸" },
    "吐魯番": { region: "港澳大陸", country: "中國大陸" },
    "阿勒泰": { region: "港澳大陸", country: "中國大陸" },
    "博樂": { region: "港澳大陸", country: "中國大陸" },
    "塔城": { region: "港澳大陸", country: "中國大陸" },
    "庫車": { region: "港澳大陸", country: "中國大陸" },
    "且末": { region: "港澳大陸", country: "中國大陸" },
    "克拉瑪依": { region: "港澳大陸", country: "中國大陸" },
    "富蘊": { region: "港澳大陸", country: "中國大陸" },
    "那拉提": { region: "港澳大陸", country: "中國大陸" },
    "布爾津": { region: "港澳大陸", country: "中國大陸" },
    "昭蘇": { region: "港澳大陸", country: "中國大陸" },
    "特克斯": { region: "港澳大陸", country: "中國大陸" },
    "尼勒克": { region: "港澳大陸", country: "中國大陸" },
    "鞏留": { region: "港澳大陸", country: "中國大陸" },
    "新源": { region: "港澳大陸", country: "中國大陸" },
    "霍城": { region: "港澳大陸", country: "中國大陸" },
    "察布查爾": { region: "港澳大陸", country: "中國大陸" },

    "曼谷": { region: "東南亞", country: "泰國" },
    "曼谷廊曼": { region: "東南亞", country: "泰國" },
    "曼谷蘇凡納布": { region: "東南亞", country: "泰國" },
    "清邁": { region: "東南亞", country: "泰國" },
    "普吉": { region: "東南亞", country: "泰國" },
    "清萊": { region: "東南亞", country: "泰國" },
    "蘇梅島": { region: "東南亞", country: "泰國" },
    "喀比": { region: "東南亞", country: "泰國" },
    "新加坡": { region: "東南亞", country: "新加坡" },
    "吉隆坡": { region: "東南亞", country: "馬來西亞" },
    "檳城": { region: "東南亞", country: "馬來西亞" },
    "沙巴": { region: "東南亞", country: "馬來西亞" },
    "亞庇": { region: "東南亞", country: "馬來西亞" },
    "古晉": { region: "東南亞", country: "馬來西亞" },
    "胡志明市": { region: "東南亞", country: "越南" },
    "河內": { region: "東南亞", country: "越南" },
    "峴港": { region: "東南亞", country: "越南" },
    "芽莊": { region: "東南亞", country: "越南" },
    "富國": { region: "東南亞", country: "越南" },
    "富國島": { region: "東南亞", country: "越南" },
    "馬尼拉": { region: "東南亞", country: "菲律賓" },
    "宿霧": { region: "東南亞", country: "菲律賓" },
    "長灘島": { region: "東南亞", country: "菲律賓" },
    "克拉克": { region: "東南亞", country: "菲律賓" },
    "公主港": { region: "東南亞", country: "菲律賓" },
    "塔比拉蘭": { region: "東南亞", country: "菲律賓" },
    "薄荷島": { region: "東南亞", country: "菲律賓" }, // Bohol
    "長灘島 (卡利博)": { region: "東南亞", country: "菲律賓" },
    "長灘島 (卡提克蘭)": { region: "東南亞", country: "菲律賓" },
    "榮市": { region: "東南亞", country: "越南" },
    "芹苴": { region: "東南亞", country: "越南" },
    "芽莊金蘭": { region: "東南亞", country: "越南" },
    "蓮姜": { region: "東南亞", country: "越南" },
    "雅加達": { region: "東南亞", country: "印尼" },
    "峇里島": { region: "東南亞", country: "印尼" },
    "泗水": { region: "東南亞", country: "印尼" },
    "金邊": { region: "東南亞", country: "柬埔寨" },
    "吳哥窟": { region: "東南亞", country: "柬埔寨" },
    "仰光": { region: "東南亞", country: "緬甸" },
    "汶萊": { region: "東南亞", country: "汶萊" },
    "斯里巴加灣": { region: "東南亞", country: "汶萊" },

    // America
    "洛杉磯": { region: "美洲", country: "美國" },
    "舊金山": { region: "美洲", country: "美國" },
    "西雅圖": { region: "美洲", country: "美國" },
    "紐約": { region: "美洲", country: "美國" },
    "芝加哥": { region: "美洲", country: "美國" },
    "休士頓": { region: "美洲", country: "美國" },
    "檀香山": { region: "美洲", country: "美國" },
    "安大略": { region: "美洲", country: "美國" },
    "溫哥華": { region: "美洲", country: "加拿大" },
    "多倫多": { region: "美洲", country: "加拿大" },

    // Europe
    "倫敦": { region: "歐洲", country: "英國" },
    "倫敦希斯洛": { region: "歐洲", country: "英國" },
    "倫敦蓋威克": { region: "歐洲", country: "英國" },
    "巴黎": { region: "歐洲", country: "法國" },
    "阿姆斯特丹": { region: "歐洲", country: "荷蘭" },
    "法蘭克福": { region: "歐洲", country: "德國" },
    "慕尼黑": { region: "歐洲", country: "德國" },
    "維也納": { region: "歐洲", country: "奧地利" },
    "羅馬": { region: "歐洲", country: "義大利" },
    "米蘭": { region: "歐洲", country: "義大利" },
    "伊斯坦堡": { region: "歐洲", country: "土耳其" },
    "布拉格": { region: "歐洲", country: "捷克" },
    "杜拜": { region: "中東", country: "阿聯酋" },
    "德里": { region: "中東", country: "印度" }, // Categorizing India under Middle East/South Asia for now or just Other Asia

    // Oceania
    "雪梨": { region: "大洋洲", country: "澳洲" },
    "墨爾本": { region: "大洋洲", country: "澳洲" },
    "布里斯本": { region: "大洋洲", country: "澳洲" },
    "奧克蘭": { region: "大洋洲", country: "紐西蘭" },
    "基督城": { region: "大洋洲", country: "紐西蘭" },
    "帛琉": { region: "大洋洲", country: "帛琉" },
    "關島": { region: "大洋洲", country: "關島" },

    // Others / Missing
    "鳳凰城": { region: "美洲", country: "美國" }, // Phoenix (if it appears in future)
    "西雅圖": { region: "美洲", country: "美國" },
    "達拉斯": { region: "美洲", country: "美國" },
    "亞特蘭大": { region: "美洲", country: "美國" },
    "底特律": { region: "美洲", country: "美國" },
    "華盛頓": { region: "美洲", country: "美國" },
    "波士頓": { region: "美洲", country: "美國" },
    "奧斯陸": { region: "歐洲", country: "挪威" },
    "斯德哥爾摩": { region: "歐洲", country: "瑞典" },
    "哥本哈根": { region: "歐洲", country: "丹麥" },
    "赫爾辛基": { region: "歐洲", country: "芬蘭" },
    "蘇黎世": { region: "歐洲", country: "瑞士" },
    "日內瓦": { region: "歐洲", country: "瑞士" },
    "馬德里": { region: "歐洲", country: "西班牙" },
    "巴塞隆納": { region: "歐洲", country: "西班牙" },
    "里斯本": { region: "歐洲", country: "葡萄牙" },
    "雅典": { region: "歐洲", country: "希臘" },
    "莫斯科": { region: "歐洲", country: "俄羅斯" },
    "海參崴": { region: "東北亞", country: "俄羅斯" },
    "金邊": { region: "東南亞", country: "柬埔寨" },
    "吳哥窟": { region: "東南亞", country: "柬埔寨" },
    "仰光": { region: "東南亞", country: "緬甸" },
    "德黑蘭": { region: "中東", country: "伊朗" },
    "杜哈": { region: "中東", country: "卡達" },
    "阿布達比": { region: "中東", country: "阿聯酋" },
    "開羅": { region: "非洲", country: "埃及" },
    "約翰尼斯堡": { region: "非洲", country: "南非" },
    "卡薩布蘭卡": { region: "非洲", country: "摩洛哥" },
    "奧克蘭": { region: "大洋洲", country: "紐西蘭" },
    "基督城": { region: "大洋洲", country: "紐西蘭" },
    "伯斯": { region: "大洋洲", country: "澳洲" },
    "阿得雷德": { region: "大洋洲", country: "澳洲" },
    "凱恩斯": { region: "大洋洲", country: "澳洲" },
    "黃金海岸": { region: "大洋洲", country: "澳洲" }
};

// Tab to Airport Mapping
const TAB_MAPPING = {
    "36-1": "桃園國際機場",
    "36-2": "高雄國際機場",
    "36-3": "臺北松山機場",
    "36-4": "臺中清泉崗機場",
    "36-5": "花蓮機場",
    "36-6": "臺南機場"  // 修正：之前漏掉，導致臺南機場所有航班未被收錄
};

function getDestinationInfo(name) {
    // Try exact match
    if (DESTINATION_MAP[name]) return DESTINATION_MAP[name];

    // Try partial match
    for (const key in DESTINATION_MAP) {
        if (name.includes(key)) return DESTINATION_MAP[key];
    }

    console.log(`Unknown destination: ${name}`); // Log unknown ones
    return { region: "其他", country: "其他" };
}

function processFiles() {
    const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
    const allData = {
        "所有": {}
    };

    console.log(`Found ${files.length} files to process.`);

    files.forEach(file => {
        const dateInfo = parseDateFromFilename(file);
        if (!dateInfo) {
            console.warn(`Skipping file with invalid name format: ${file}`);
            return;
        }

        console.log(`Processing ${file} (${dateInfo.year}-${dateInfo.month})...`);
        const filePath = path.join(sourceDir, file);
        const workbook = XLSX.readFile(filePath);

        // Iterate through relevant tabs
        for (const tabName of workbook.SheetNames) {
            // console.log(`Checking sheet: ${tabName}`); // Debug logging
            let airportName = "其他機場";
            let matchedTab = false;

            // Check if tab matches our mapping
            for (const key in TAB_MAPPING) {
                // Match "36", "36-1" etc. strictly or contained
                // The sheet names might be "表36", "表36-1", "Table 36", etc.
                // We want to match "36" but avoid "36-1" when looking for "36".

                // Check if tabName contains the key
                if (tabName.includes(key)) {
                    // If key is "36", ensure it's not "36-1", "36-2", etc.
                    if (key === "36" && tabName.match(/36-\d/)) continue;

                    airportName = TAB_MAPPING[key];
                    matchedTab = true;
                    break;
                }
            }

            if (!matchedTab) continue;

            const sheet = workbook.Sheets[tabName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            // Content-based Airport Detection (Override)
            // Check footer or header for specific airport names
            // Common footers: "資料來源：本局高雄國際航空站", "資料來源：臺北國際航空站" (Songshan)
            const contentString = JSON.stringify(data);
            if (contentString.includes("高雄國際航空站")) {
                airportName = "高雄國際機場";
            } else if (contentString.includes("臺北國際航空站")) {
                airportName = "臺北松山機場";
            } else if (contentString.includes("臺中航空站")) {
                airportName = "臺中清泉崗機場";
            } else if (contentString.includes("臺南航空站")) {
                airportName = "臺南機場";
            } else if (contentString.includes("桃園國際機場")) {
                airportName = "桃園國際機場";
            }

            console.log(`  Processing Sheet: ${tabName} -> ${airportName}`);

            let currentRegion = '';
            let currentDestination = '';

            // Locate header row
            let headerIdx = -1;
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                if (row.some(cell => String(cell).includes('航線') || String(cell).includes('航空公司'))) {
                    headerIdx = i;
                    break;
                }
            }

            if (headerIdx === -1) {
                console.warn(`    Could not find header in ${tabName}`);
                continue;
            }

            // Process rows after header
            for (let i = headerIdx + 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                // Clean strings
                const col0 = String(row[0] || '').trim().replace(/\s+/g, '');
                const col1 = String(row[1] || '').trim().replace(/\s+/g, '');
                const col2 = String(row[2] || '').trim().replace(/\s+/g, '');

                // Logic to identify Destination vs Airline
                // Based on inspection:
                // Row 10: ["國際航線...", "", "", ...] -> Region
                // Row 11: ["", "大阪", "", ...] -> Destination
                // Row 12: ["1", "", "中華", ...] -> Airline

                if (col0.includes('航線') || col0.includes('總計')) {
                    currentRegion = col0;
                    continue;
                }

                if (col1 && !col2) {
                    currentDestination = col1;
                    continue;
                }

                // If we have an airline in Col 2 (and it's not empty)
                if (col2 && currentDestination) {
                    const airline = col2;

                    // Indices from inspection:
                    // Col 3: Total Flights
                    // Col 4: Total Seats
                    // Col 5: Total Passengers
                    // Col 6: Load Factor (Total)

                    const flights = parseInt(String(row[3]).replace(/,/g, '')) || 0;
                    const seats = parseInt(String(row[4]).replace(/,/g, '')) || 0;
                    const passengers = parseInt(String(row[5]).replace(/,/g, '')) || 0;

                    if (flights === 0 && seats === 0 && passengers === 0) continue;

                    // Categorize Destination
                    const destInfo = getDestinationInfo(currentDestination);

                    // Structure: Region -> Country -> Airport -> Destination -> Airline
                    // But app.js expects: "所有" -> Airport -> Destination -> Airline
                    // We need to embed the country info into the destination or handle it in the app.
                    // The user wants "Japan -> Tokyo Narita".
                    // Let's stick to the app's structure but maybe enrich the destination name or handle grouping in UI.
                    // Actually, the user wants "Japan -> Tokyo Narita" in the UI.
                    // The data structure in flight_data_new.js is:
                    // "所有": { Airport: { Destination: { Airline: [records] } } }

                    // We can keep this structure and do the grouping in the UI based on the destination name.
                    // OR we can add metadata.
                    // Let's stick to the current structure but ensure we have all airports.
                    // We will add a "meta" field to the record? No, that duplicates data.
                    // We will create a separate metadata object or just rely on the map in the App.

                    // Let's just ensure the data is populated correctly under the right Airport.

                    if (!allData["所有"][airportName]) {
                        allData["所有"][airportName] = {};
                    }
                    if (!allData["所有"][airportName][currentDestination]) {
                        allData["所有"][airportName][currentDestination] = {};
                    }
                    if (!allData["所有"][airportName][currentDestination][airline]) {
                        allData["所有"][airportName][currentDestination][airline] = [];
                    }

                    allData["所有"][airportName][currentDestination][airline].push({
                        year: dateInfo.year,
                        month: dateInfo.month,
                        flights: flights,
                        seats: seats,
                        passengers: passengers,
                        // Add extra info for UI if needed, but better to keep data clean
                    });
                }
            }
        }
    });

    // Write to file
    const fileContent = `// This file is auto-generated by process_data.js
// Contains the flight data object.
const flightData = ${JSON.stringify(allData, null, 4)};

const DESTINATION_MAP = ${JSON.stringify(DESTINATION_MAP, null, 4)};

// Export destination map for UI use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { flightData, DESTINATION_MAP };
}
// For browser environment
if (typeof window !== 'undefined') {
    window.flightData = flightData;
    window.DESTINATION_MAP = DESTINATION_MAP;
}
`;
    fs.writeFileSync(outputFile, fileContent);
    console.log(`Successfully wrote data to ${outputFile}`);
}

processFiles();
