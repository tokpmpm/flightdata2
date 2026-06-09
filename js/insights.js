/**
 * Insights and Data Analytics Component
 * Calculates KPIs, natural language insights, route rankings, and load factor heatmap.
 * Designed to support both Browser dynamic updates and Node.js SSG pre-rendering.
 */

// Helper to determine environment
const isInBrowser = typeof window !== 'undefined';

/**
 * Calculate all insights data from filtered data
 * @param {Array} filteredData - Currently filtered flight records
 * @param {Array} rawData - All flight records (used for calculating relative percentages)
 * @returns {Object} Calculated metrics
 */
function calculateInsightsData(filteredData, rawData = []) {
    if (!filteredData || filteredData.length === 0) {
        return {
            kpis: { totalPassengers: 0, totalFlights: 0, avgLoadFactor: 0, peakMonth: '-', peakMonthLF: 0 },
            textInsights: [],
            topRoutes: [],
            heatmap: { years: [], matrix: {} }
        };
    }

    // 1. Calculate basic totals
    let totalPassengers = 0;
    let totalFlights = 0;
    let totalSeats = 0;
    const monthlyTotals = {};

    filteredData.forEach(d => {
        totalPassengers += d.passengers || 0;
        totalFlights += d.flights || 0;
        totalSeats += d.totalSeats || 0;

        if (d.yearMonth) {
            if (!monthlyTotals[d.yearMonth]) {
                monthlyTotals[d.yearMonth] = { passengers: 0, seats: 0 };
            }
            monthlyTotals[d.yearMonth].passengers += d.passengers || 0;
            monthlyTotals[d.yearMonth].seats += d.totalSeats || 0;
        }
    });

    const avgLoadFactor = totalSeats ? (totalPassengers / totalSeats) * 100 : 0;

    // 2. Find peak month
    let peakMonth = '-';
    let peakMonthLF = 0;
    for (const ym in monthlyTotals) {
        const seats = monthlyTotals[ym].seats;
        const lf = seats ? (monthlyTotals[ym].passengers / seats) * 100 : 0;
        if (lf > peakMonthLF) {
            peakMonthLF = lf;
            peakMonth = ym;
        }
    }

    // 3. Top Destinations (Routes)
    const destStats = {};
    filteredData.forEach(d => {
        if (!d.destination) return;
        if (!destStats[d.destination]) {
            destStats[d.destination] = { name: d.destination, passengers: 0, seats: 0 };
        }
        destStats[d.destination].passengers += d.passengers || 0;
        destStats[d.destination].seats += d.totalSeats || 0;
    });

    const topRoutes = Object.values(destStats)
        .map(r => ({
            name: r.name,
            passengers: r.passengers,
            avgLF: r.seats ? (r.passengers / r.seats) * 100 : 0,
            pct: totalPassengers ? (r.passengers / totalPassengers) * 100 : 0
        }))
        .sort((a, b) => b.passengers - a.passengers)
        .slice(0, 10);

    // 4. Heatmap Data (Year x Month matrix)
    const yearsSet = new Set();
    const heatmapData = {}; // year -> array of 12 elements (0-11 index)

    filteredData.forEach(d => {
        if (d.year && d.month) {
            yearsSet.add(d.year);
            if (!heatmapData[d.year]) {
                heatmapData[d.year] = Array(12).fill(null).map(() => ({ passengers: 0, seats: 0 }));
            }
            const mIdx = d.month - 1;
            heatmapData[d.year][mIdx].passengers += d.passengers || 0;
            heatmapData[d.year][mIdx].seats += d.totalSeats || 0;
        }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a); // Newest year on top
    const heatmapMatrix = {};
    years.forEach(yr => {
        heatmapMatrix[yr] = heatmapData[yr].map(m => {
            return m.seats ? (m.passengers / m.seats) * 100 : null;
        });
    });

    // 5. Smart NLP Insights Generation
    const textInsights = [];

    // Insight A: Airport and Destination share
    const isSpecificAirport = filteredData.every(d => d.airport === filteredData[0].airport);
    const activeAirport = isSpecificAirport ? filteredData[0].airport : null;

    const isSpecificDest = filteredData.every(d => d.destination === filteredData[0].destination);
    const activeDest = isSpecificDest ? filteredData[0].destination : null;

    if (activeDest && rawData && rawData.length > 0) {
        // Calculate date filter set
        const dateFilterSet = new Set(filteredData.map(d => d.yearMonth));
        let periodTotalPassengers = 0;
        let airportTotalPassengers = 0;

        rawData.forEach(d => {
            if (dateFilterSet.has(d.yearMonth)) {
                periodTotalPassengers += d.passengers || 0;
                if (activeAirport && d.airport === activeAirport) {
                    airportTotalPassengers += d.passengers || 0;
                }
            }
        });

        if (activeAirport) {
            // Case 1: Route-specific share inside the airport
            const routeShare = airportTotalPassengers ? (totalPassengers / airportTotalPassengers) * 100 : 0;
            textInsights.push({
                icon: '✈️',
                text: `在選定統計期間內，往返 <strong>${activeDest}</strong> 的出入境旅客人次達 ${totalPassengers.toLocaleString()} 人，佔 <strong>${activeAirport}</strong> 該期間總出入境運量的 <strong>${routeShare.toFixed(2)}%</strong>。`,
                highlight: activeDest
            });
        } else {
            // Case 2: Destination-specific share inside the whole country
            const destShare = periodTotalPassengers ? (totalPassengers / periodTotalPassengers) * 100 : 0;
            textInsights.push({
                icon: '🌏',
                text: `在選定統計期間內，全台往返 <strong>${activeDest}</strong> 的出入境旅客人次達 ${totalPassengers.toLocaleString()} 人，佔全台總運量的 <strong>${destShare.toFixed(2)}%</strong>。`,
                highlight: activeDest
            });
        }
    } else if (activeAirport && rawData && rawData.length > 0) {
        // Case 3: Airport-wide share (no specific destination selected)
        const dateFilterSet = new Set(filteredData.map(d => d.yearMonth));
        let periodTotalPassengers = 0;
        let airportTotalPassengers = 0;

        rawData.forEach(d => {
            if (dateFilterSet.has(d.yearMonth)) {
                periodTotalPassengers += d.passengers || 0;
                if (d.airport === activeAirport) {
                    airportTotalPassengers += d.passengers || 0;
                }
            }
        });

        const share = periodTotalPassengers ? (airportTotalPassengers / periodTotalPassengers) * 100 : 0;
        textInsights.push({
            icon: '🛫',
            text: `在選定統計期間內，<strong>${activeAirport}</strong> 的出入境旅客人次達 ${airportTotalPassengers.toLocaleString()} 人，佔全台總運量的 <strong>${share.toFixed(1)}%</strong>。`,
            highlight: activeAirport
        });
    } else {
        // Case 4: Default (no filters, show top airport)
        const airportStats = {};
        filteredData.forEach(d => {
            if (!airportStats[d.airport]) airportStats[d.airport] = 0;
            airportStats[d.airport] += d.passengers || 0;
        });
        let topAirport = '-';
        let topAirportVal = 0;
        for (const ap in airportStats) {
            if (airportStats[ap] > topAirportVal) {
                topAirportVal = airportStats[ap];
                topAirport = ap;
            }
        }
        const share = totalPassengers ? (topAirportVal / totalPassengers) * 100 : 0;
        textInsights.push({
            icon: '🏢',
            text: `<strong>${topAirport}</strong> 為統計範圍內最繁忙的起降機場，貢獻了 <strong>${share.toFixed(1)}%</strong> 的旅客量（共 ${topAirportVal.toLocaleString()} 人次）。`,
            highlight: topAirport
        });
    }

    // Insight B: Best performing airline (avg load factor, min 10 flights to avoid outliers)
    const airlineStats = {};
    filteredData.forEach(d => {
        if (!airlineStats[d.airline]) {
            airlineStats[d.airline] = { passengers: 0, seats: 0, flights: 0 };
        }
        airlineStats[d.airline].passengers += d.passengers || 0;
        airlineStats[d.airline].seats += d.totalSeats || 0;
        airlineStats[d.airline].flights += d.flights || 0;
    });

    let bestAirline = '-';
    let bestAirlineLF = 0;
    let bestAirlineFlights = 0;

    for (const al in airlineStats) {
        const item = airlineStats[al];
        // Filter out very small flight counts (e.g. less than 10 flights) to get representative airlines
        if (item.flights >= 10 && item.seats > 0) {
            const lf = (item.passengers / item.seats) * 100;
            if (lf > bestAirlineLF) {
                bestAirlineLF = lf;
                bestAirline = al;
                bestAirlineFlights = item.flights;
            }
        }
    }

    if (bestAirline !== '-') {
        textInsights.push({
            icon: '🏆',
            text: `表現最佳的航空公司為 <strong>${bestAirline}</strong>，在執飛 ${bestAirlineFlights} 班次中平均載客率高達 <strong>${bestAirlineLF.toFixed(1)}%</strong>。`,
            highlight: bestAirline
        });
    }

    // Insight C: Peak Month & Seasonality
    if (peakMonth !== '-') {
        const monthMap = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6', '07': '7', '08': '8', '09': '9', '10': '10', '11': '11', '12': '12' };
        const parts = peakMonth.split('-');
        const formattedMonth = `${parts[0]}年${monthMap[parts[1]] || parts[1]}月`;
        textInsights.push({
            icon: '🔥',
            text: `統計期間內的載客率巔峰期落於 <strong>${formattedMonth}</strong>，全體平均座位利用率衝上 <strong>${peakMonthLF.toFixed(1)}%</strong>（暑假或年節效應）。`,
            highlight: formattedMonth
        });
    }

    // Insight D: Top route market share (only show if multiple routes exist to make sense)
    if (topRoutes.length > 1) {
        const topRoute = topRoutes[0];
        textInsights.push({
            icon: '📍',
            text: `首要航點為 <strong>${topRoute.name}</strong>，單一航點即佔去該篩選總運量的 <strong>${topRoute.pct.toFixed(1)}%</strong>，平均載客率達 ${topRoute.avgLF.toFixed(1)}%。`,
            highlight: topRoute.name
        });
    }

    // Insight E: YoY Growth Analysis (comparing same months for incomplete years)
    const yearlyMonthlyPassengers = {};
    filteredData.forEach(d => {
        if (!yearlyMonthlyPassengers[d.year]) {
            yearlyMonthlyPassengers[d.year] = {};
        }
        if (!yearlyMonthlyPassengers[d.year][d.month]) {
            yearlyMonthlyPassengers[d.year][d.month] = 0;
        }
        yearlyMonthlyPassengers[d.year][d.month] += d.passengers || 0;
    });

    const availYears = Object.keys(yearlyMonthlyPassengers).map(Number).sort((a, b) => b - a); // Newest first
    if (availYears.length >= 2) {
        const currYear = availYears[0];
        const prevYear = availYears[1];

        // Find months with data in current year
        const currMonths = Object.keys(yearlyMonthlyPassengers[currYear]).map(Number).sort((a, b) => a - b);
        
        if (currMonths.length > 0) {
            let currSum = 0;
            let prevSumInSameMonths = 0;
            let comparableMonthsCount = 0;

            currMonths.forEach(m => {
                const currVal = yearlyMonthlyPassengers[currYear][m] || 0;
                if (yearlyMonthlyPassengers[prevYear] && yearlyMonthlyPassengers[prevYear][m] !== undefined) {
                    currSum += currVal;
                    prevSumInSameMonths += yearlyMonthlyPassengers[prevYear][m];
                    comparableMonthsCount++;
                }
            });

            if (comparableMonthsCount > 0 && prevSumInSameMonths > 0) {
                const growth = ((currSum - prevSumInSameMonths) / prevSumInSameMonths) * 100;
                const sign = growth >= 0 ? '+' : '';
                
                let periodDesc = '';
                if (currMonths.length === 12 && comparableMonthsCount === 12) {
                    periodDesc = `${currYear} 全年度`;
                } else {
                    const startMonth = currMonths[0];
                    const endMonth = currMonths[currMonths.length - 1];
                    periodDesc = `${currYear} 年 ${startMonth}至${endMonth} 月`;
                }

                textInsights.push({
                    icon: '📊',
                    text: `<strong>同期對比 (YoY)</strong>：${periodDesc} 載客量相比 ${prevYear} 年同期呈現 <strong>${sign}${growth.toFixed(1)}%</strong> 的增減變化。`,
                    highlight: '同期對比 (YoY)'
                });
            }
        }
    }

    // Insight F: Peak/Off-peak analysis for single route
    const isSingleRoute = Object.keys(destStats).length === 1;
    if (isSingleRoute) {
        const routeName = Object.keys(destStats)[0];
        const monthStats = Array(12).fill(null).map(() => ({ passengers: 0, seats: 0 }));
        
        filteredData.forEach(d => {
            if (d.month >= 1 && d.month <= 12) {
                const idx = d.month - 1;
                monthStats[idx].passengers += d.passengers || 0;
                monthStats[idx].seats += d.totalSeats || 0;
            }
        });
        
        const monthlyLF = monthStats.map((item, index) => {
            return {
                month: index + 1,
                lf: item.seats ? (item.passengers / item.seats) * 100 : 0,
                hasData: item.seats > 0
            };
        }).filter(item => item.hasData);
        
        if (monthlyLF.length >= 2) {
            const sortedByLF = [...monthlyLF].sort((a, b) => b.lf - a.lf);
            const peakMonthInfo = sortedByLF[0];
            const offPeakMonthInfo = sortedByLF[sortedByLF.length - 1];
            
            textInsights.push({
                icon: '⏳',
                text: `<strong>淡旺季分析</strong>：<strong>${routeName}</strong> 航線歷史上以 <strong>${peakMonthInfo.month}月</strong> 最旺（平均載客率 ${peakMonthInfo.lf.toFixed(1)}%），而 <strong>${offPeakMonthInfo.month}月</strong> 則為相對淡季（平均載客率 ${offPeakMonthInfo.lf.toFixed(1)}%）。`,
                highlight: '淡旺季分析'
            });
        }
    }

    return {
        kpis: {
            totalPassengers,
            totalFlights,
            avgLoadFactor,
            peakMonth,
            peakMonthLF
        },
        textInsights,
        topRoutes,
        heatmap: {
            years,
            matrix: heatmapMatrix
        }
    };
}

/**
 * Count Up Animation for numerical values in browser
 */
function animateValue(elementId, start, end, duration, isPercentage = false, isInteger = false) {
    const obj = document.getElementById(elementId);
    if (!obj) return;
    
    // Clear any existing animation timer on this element to prevent conflicts
    if (obj.dataset.timerId) {
        clearInterval(parseInt(obj.dataset.timerId));
        delete obj.dataset.timerId;
    }

    if (end === 0 || isNaN(end)) {
        obj.textContent = isPercentage ? '0%' : '0';
        return;
    }

    // For peak month strings, do not animate
    if (typeof end === 'string' && isNaN(Number(end))) {
        obj.textContent = end;
        return;
    }

    // If start and end are the same (or change is negligible), apply immediately and exit
    if (Math.abs(end - start) < 0.01) {
        if (isPercentage) {
            obj.textContent = `${end.toFixed(1)}%`;
        } else if (isInteger) {
            obj.textContent = Math.round(end).toLocaleString();
        } else {
            obj.textContent = end.toFixed(0).toLocaleString();
        }
        return;
    }

    const range = end - start;
    let current = start;
    const stepTime = 16; // Approx 60fps
    
    const timer = setInterval(() => {
        current += (range / (duration / stepTime));
        
        // Check if animation completed
        if ((range > 0 && current >= end) || (range < 0 && current <= end)) {
            clearInterval(timer);
            delete obj.dataset.timerId;
            current = end;
        }
        
        if (isPercentage) {
            obj.textContent = `${current.toFixed(1)}%`;
        } else if (isInteger) {
            obj.textContent = Math.round(current).toLocaleString();
        } else {
            obj.textContent = current.toFixed(0).toLocaleString();
        }
    }, stepTime);

    // Save timer ID on the element to allow future cancellations
    obj.dataset.timerId = timer;
}

/**
 * Render all insight components in the browser DOM
 * @param {Object} data - Calculated insights data
 */
function renderInsightsUI(data) {
    if (!isInBrowser) return;

    // 1. Render KPIs (with animation)
    const prevPassengers = parseInt(document.getElementById('kpi-passengers-value')?.textContent.replace(/,/g, '')) || 0;
    const prevFlights = parseInt(document.getElementById('kpi-flights-value')?.textContent.replace(/,/g, '')) || 0;
    const prevLF = parseFloat(document.getElementById('kpi-load-factor-value')?.textContent) || 0;

    animateValue('kpi-passengers-value', prevPassengers, data.kpis.totalPassengers, 800, false, true);
    animateValue('kpi-flights-value', prevFlights, data.kpis.totalFlights, 800, false, true);
    animateValue('kpi-load-factor-value', prevLF, data.kpis.avgLoadFactor, 800, true);

    // Render Peak Month (No animation)
    const peakMonthObj = document.getElementById('kpi-peak-month-value');
    if (peakMonthObj) {
        if (data.kpis.peakMonth !== '-') {
            const parts = data.kpis.peakMonth.split('-');
            const monthMap = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6', '07': '7', '08': '8', '09': '9', '10': '10', '11': '11', '12': '12' };
            const mName = monthMap[parts[1]] || parts[1];
            peakMonthObj.innerHTML = `<span class="peak-month-text">${parts[0].substring(2)}年${mName}月</span> <span class="peak-month-val">${data.kpis.peakMonthLF.toFixed(1)}%</span>`;
        } else {
            peakMonthObj.textContent = '-';
        }
    }

    // 2. Render Smart NLP Insights List
    const insightsListObj = document.getElementById('insights-list');
    if (insightsListObj) {
        if (data.textInsights.length === 0) {
            insightsListObj.innerHTML = '<li>⚠️ 目前篩選條件下沒有足夠的數據產生洞察。</li>';
        } else {
            insightsListObj.innerHTML = data.textInsights
                .map(ins => `<li><span class="insight-icon">${ins.icon}</span> <span class="insight-text">${ins.text}</span></li>`)
                .join('');
        }
    }

    // 3. Render Top Routes (HTML Bar Chart)
    const topRoutesListObj = document.getElementById('top-routes-list');
    if (topRoutesListObj) {
        if (data.topRoutes.length === 0) {
            topRoutesListObj.innerHTML = '<div class="no-data-msg">暫無熱門航點數據</div>';
        } else {
            const maxVal = data.topRoutes[0].passengers; // Highest value for 100% width scaling
            topRoutesListObj.innerHTML = data.topRoutes
                .map((r, idx) => {
                    const barWidth = maxVal ? (r.passengers / maxVal) * 100 : 0;
                    return `
                        <div class="route-item">
                            <div class="route-info">
                                <span class="route-name">${idx + 1}. ${r.name}</span>
                                <span class="route-stats">
                                    <strong>${r.passengers.toLocaleString()}</strong> 人 
                                    <span class="lf-badge">載客率 ${r.avgLF.toFixed(1)}%</span>
                                    <span class="pct-badge">佔 ${r.pct.toFixed(1)}%</span>
                                </span>
                            </div>
                            <div class="route-bar-wrapper">
                                <div class="route-bar" style="width: ${barWidth}%" title="旅客量: ${r.passengers.toLocaleString()} 人"></div>
                            </div>
                        </div>
                    `;
                })
                .join('');
        }
    }

    // 4. Render Heatmap (HTML Table Grid)
    const heatmapContainer = document.getElementById('heatmap-container');
    if (heatmapContainer) {
        const { years, matrix } = data.heatmap;
        if (years.length === 0) {
            heatmapContainer.innerHTML = '<div class="no-data-msg">暫無座位利用率熱力圖數據</div>';
        } else {
            let html = `
                <table class="heatmap-table">
                    <thead>
                        <tr>
                            <th>年份</th>
                            <th>1月</th><th>2月</th><th>3月</th><th>4月</th><th>5月</th><th>6月</th>
                            <th>7月</th><th>8月</th><th>9月</th><th>10月</th><th>11月</th><th>12月</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            years.forEach(yr => {
                html += `<tr><td class="heatmap-year-cell">${yr}</td>`;
                const monthsLF = matrix[yr];
                for (let i = 0; i < 12; i++) {
                    const lf = monthsLF[i];
                    if (lf === null || lf === undefined || lf === 0) {
                        html += `<td class="heatmap-cell lf-empty" title="${yr}年${i + 1}月: 無數據">-</td>`;
                    } else {
                        // Classify load factor level
                        let levelClass = 'lf-level-0'; // < 50%
                        if (lf >= 90) levelClass = 'lf-level-4';
                        else if (lf >= 85) levelClass = 'lf-level-3';
                        else if (lf >= 70) levelClass = 'lf-level-2';
                        else if (lf >= 50) levelClass = 'lf-level-1';

                        html += `<td class="heatmap-cell ${levelClass}" title="${yr}年${i + 1}月: 載客率 ${lf.toFixed(1)}%">${lf.toFixed(1)}%</td>`;
                    }
                }
                html += `</tr>`;
            });

            html += `
                    </tbody>
                </table>
            `;
            heatmapContainer.innerHTML = html;
        }
    }
}

/**
 * Generate Static HTML for pre-rendering (returns HTML strings for injection)
 * @param {Object} data - Calculated insights data
 * @returns {Object} { kpiHtml, insightsHtml, routesHtml, heatmapHtml }
 */
function generateStaticInsightsHTML(data) {
    // 1. KPI HTML
    let kpiHtml = `
        <div class="kpi-card" id="kpi-passengers">
            <div class="kpi-title"><span class="kpi-icon">📊</span>總載客數</div>
            <div class="kpi-value" id="kpi-passengers-value">${data.kpis.totalPassengers.toLocaleString()}</div>
            <div class="kpi-sub">統計期間載客總人數</div>
        </div>
        <div class="kpi-card" id="kpi-flights">
            <div class="kpi-title"><span class="kpi-icon">🛫</span>總航班數</div>
            <div class="kpi-value" id="kpi-flights-value">${data.kpis.totalFlights.toLocaleString()}</div>
            <div class="kpi-sub">統計期間起降總班次</div>
        </div>
        <div class="kpi-card" id="kpi-load-factor">
            <div class="kpi-title"><span class="kpi-icon">📈</span>平均載客率</div>
            <div class="kpi-value" id="kpi-load-factor-value">${data.kpis.avgLoadFactor.toFixed(1)}%</div>
            <div class="kpi-sub">乘客數 / 總座位數</div>
        </div>
        <div class="kpi-card" id="kpi-peak-month">
            <div class="kpi-title"><span class="kpi-icon">🔝</span>最旺月份</div>
            <div class="kpi-value" id="kpi-peak-month-value">
    `;
    if (data.kpis.peakMonth !== '-') {
        const parts = data.kpis.peakMonth.split('-');
        const monthMap = { '01': '1', '02': '2', '03': '3', '04': '4', '05': '5', '06': '6', '07': '7', '08': '8', '09': '9', '10': '10', '11': '11', '12': '12' };
        const mName = monthMap[parts[1]] || parts[1];
        kpiHtml += `<span class="peak-month-text">${parts[0].substring(2)}年${mName}月</span> <span class="peak-month-val">${data.kpis.peakMonthLF.toFixed(1)}%</span>`;
    } else {
        kpiHtml += `-`;
    }
    kpiHtml += `
            </div>
            <div class="kpi-sub">最高載客率月份及數值</div>
        </div>
    `;

    // 2. Text Insights HTML
    let insightsHtml = '';
    if (data.textInsights.length === 0) {
        insightsHtml = '<li>⚠️ 目前篩選條件下沒有足夠的數據產生洞察。</li>';
    } else {
        insightsHtml = data.textInsights
            .map(ins => `<li><span class="insight-icon">${ins.icon}</span> <span class="insight-text">${ins.text}</span></li>`)
            .join('');
    }

    // 3. Top Routes HTML
    let routesHtml = '';
    if (data.topRoutes.length === 0) {
        routesHtml = '<div class="no-data-msg">暫無熱門航點數據</div>';
    } else {
        const maxVal = data.topRoutes[0].passengers;
        routesHtml = data.topRoutes
            .map((r, idx) => {
                const barWidth = maxVal ? (r.passengers / maxVal) * 100 : 0;
                return `
                    <div class="route-item">
                        <div class="route-info">
                            <span class="route-name">${idx + 1}. ${r.name}</span>
                            <span class="route-stats">
                                <strong>${r.passengers.toLocaleString()}</strong> 人 
                                <span class="lf-badge">載客率 ${r.avgLF.toFixed(1)}%</span>
                                <span class="pct-badge">佔 ${r.pct.toFixed(1)}%</span>
                            </span>
                        </div>
                        <div class="route-bar-wrapper">
                            <div class="route-bar" style="width: ${barWidth}%" title="旅客量: ${r.passengers.toLocaleString()} 人"></div>
                        </div>
                    </div>
                `;
            })
            .join('');
    }

    // 4. Heatmap HTML
    let heatmapHtml = '';
    const { years, matrix } = data.heatmap;
    if (years.length === 0) {
        heatmapHtml = '<div class="no-data-msg">暫無座位利用率熱力圖數據</div>';
    } else {
        heatmapHtml = `
            <table class="heatmap-table">
                <thead>
                    <tr>
                        <th>年份</th>
                        <th>1月</th><th>2月</th><th>3月</th><th>4月</th><th>5月</th><th>6月</th>
                        <th>7月</th><th>8月</th><th>9月</th><th>10月</th><th>11月</th><th>12月</th>
                    </tr>
                </thead>
                <tbody>
        `;

        years.forEach(yr => {
            heatmapHtml += `<tr><td class="heatmap-year-cell">${yr}</td>`;
            const monthsLF = matrix[yr];
            for (let i = 0; i < 12; i++) {
                const lf = monthsLF[i];
                if (lf === null || lf === undefined || lf === 0) {
                    heatmapHtml += `<td class="heatmap-cell lf-empty" title="${yr}年${i + 1}月: 無數據">-</td>`;
                } else {
                    let levelClass = 'lf-level-0';
                    if (lf >= 90) levelClass = 'lf-level-4';
                    else if (lf >= 85) levelClass = 'lf-level-3';
                    else if (lf >= 70) levelClass = 'lf-level-2';
                    else if (lf >= 50) levelClass = 'lf-level-1';

                    heatmapHtml += `<td class="heatmap-cell ${levelClass}" title="${yr}年${i + 1}月: 載客率 ${lf.toFixed(1)}%">${lf.toFixed(1)}%</td>`;
                }
            }
            heatmapHtml += `</tr>`;
        });

        heatmapHtml += `
                </tbody>
            </table>
        `;
    }

    return {
        kpiHtml,
        insightsHtml,
        routesHtml,
        heatmapHtml
    };
}

// Export for Node.js if relevant
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateInsightsData,
        generateStaticInsightsHTML
    };
}
