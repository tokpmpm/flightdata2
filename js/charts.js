/**
 * Chart Rendering Functions
 * Uses Chart.js to create interactive visualizations.
 * Designed to support both Browser dynamic updates and Node.js pre-rendering.
 */

// Global variable for doughnut chart metric
let currentShareMetric = 'passengers';
let shareChartEventsInitialized = false;

/**
 * Helper to get CSS variables in browser
 */
function getCssVar(name, fallback) {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
}

/**
 * Initialize chart event listeners
 */
function initChartEvents() {
    if (typeof window === 'undefined') return;
    if (shareChartEventsInitialized) return;

    const btnPassengers = document.getElementById('share-by-passengers');
    const btnFlights = document.getElementById('share-by-flights');

    if (btnPassengers && btnFlights) {
        btnPassengers.addEventListener('click', () => {
            btnPassengers.classList.add('active');
            btnFlights.classList.remove('active');
            currentShareMetric = 'passengers';
            updateAirlineShareChart();
        });

        btnFlights.addEventListener('click', () => {
            btnFlights.classList.add('active');
            btnPassengers.classList.remove('active');
            currentShareMetric = 'flights';
            updateAirlineShareChart();
        });
        
        shareChartEventsInitialized = true;
    }
}

/**
 * Update Load Factor Trend Chart
 * Shows load factor trends by airline over time
 */
function updateLoadFactorChart() {
    const ctx = document.getElementById('load-factor-chart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (AppState.charts.loadFactor) {
        AppState.charts.loadFactor.destroy();
    }

    // Aggregate data by airline and month
    const dataByAirline = new Map();
    const allMonths = new Set();

    AppState.filteredData.forEach(record => {
        if (!dataByAirline.has(record.airline)) {
            dataByAirline.set(record.airline, new Map());
        }

        const airlineData = dataByAirline.get(record.airline);
        if (!airlineData.has(record.yearMonth)) {
            airlineData.set(record.yearMonth, { totalPassengers: 0, totalSeats: 0 });
        }

        const monthData = airlineData.get(record.yearMonth);
        monthData.totalPassengers += record.passengers;
        monthData.totalSeats += record.totalSeats;

        allMonths.add(record.yearMonth);
    });

    // Prepare datasets
    const months = Array.from(allMonths).sort();
    const datasets = [];

    let colorIndex = 0;
    dataByAirline.forEach((monthData, airline) => {
        const data = months.map(month => {
            const d = monthData.get(month);
            if (d && d.totalSeats > 0) {
                return (d.totalPassengers / d.totalSeats * 100).toFixed(2);
            }
            return null;
        });

        const color = window.getAirlineColor ? window.getAirlineColor(airline, colorIndex) : '#3b82f6';

        datasets.push({
            label: airline,
            data: data,
            borderColor: color,
            backgroundColor: color,
            borderWidth: 3,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false
        });

        colorIndex++;
    });

    // Create chart
    AppState.charts.loadFactor = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: getCssVar('--color-text-primary', '#292524'),
                        font: { size: 11 },
                        padding: 10,
                        usePointStyle: true,
                        boxWidth: 30
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#292524',
                    bodyColor: '#57534e',
                    borderColor: '#e7e5e4',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: getCssVar('--color-border', '#e7e5e4'),
                        borderColor: getCssVar('--color-border', '#e7e5e4')
                    },
                    ticks: {
                        color: getCssVar('--color-text-secondary', '#57534e'),
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: getCssVar('--color-border', '#e7e5e4'),
                        borderColor: getCssVar('--color-border', '#e7e5e4')
                    },
                    ticks: {
                        color: getCssVar('--color-text-secondary', '#57534e'),
                        callback: function (value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: '載客率 (%)',
                        color: getCssVar('--color-text-primary', '#292524'),
                        font: { weight: 'bold' }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * Update Stacked Passengers Chart
 * Shows monthly total passengers by airline (stacked bar chart)
 */
function updateStackedPassengersChart() {
    const ctx = document.getElementById('stacked-passengers-chart');
    if (!ctx) return;

    if (AppState.charts.stackedPassengers) {
        AppState.charts.stackedPassengers.destroy();
    }

    // Aggregate data
    const dataByMonth = new Map();
    const airlines = new Set();

    AppState.filteredData.forEach(record => {
        airlines.add(record.airline);

        if (!dataByMonth.has(record.yearMonth)) {
            dataByMonth.set(record.yearMonth, new Map());
        }

        const monthData = dataByMonth.get(record.yearMonth);
        monthData.set(record.airline, (monthData.get(record.airline) || 0) + record.passengers);
    });

    const months = Array.from(dataByMonth.keys()).sort();
    const datasets = [];

    let colorIndex = 0;
    airlines.forEach(airline => {
        const data = months.map(month => {
            const monthData = dataByMonth.get(month);
            return monthData.get(airline) || 0;
        });

        const color = window.getAirlineColor ? window.getAirlineColor(airline, colorIndex) : '#3b82f6';

        datasets.push({
            label: airline,
            data: data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
        });

        colorIndex++;
    });

    AppState.charts.stackedPassengers = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: getCssVar('--color-text-primary', '#292524'),
                        font: { size: 11 },
                        padding: 10,
                        usePointStyle: true,
                        boxWidth: 30
                    }
                },
                tooltip: {
                    mode: 'index',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#292524',
                    bodyColor: '#57534e',
                    borderColor: '#e7e5e4',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} 人`;
                        },
                        footer: function (items) {
                            const sum = items.reduce((a, b) => a + b.parsed.y, 0);
                            return `總計: ${sum.toLocaleString()} 人`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: getCssVar('--color-border', '#e7e5e4'),
                        borderColor: getCssVar('--color-border', '#e7e5e4')
                    },
                    ticks: {
                        color: getCssVar('--color-text-secondary', '#57534e'),
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: getCssVar('--color-border', '#e7e5e4'),
                        borderColor: getCssVar('--color-border', '#e7e5e4')
                    },
                    ticks: {
                        color: getCssVar('--color-text-secondary', '#57534e'),
                        callback: function (value) {
                            return (value / 1000).toFixed(0) + 'K';
                        }
                    },
                    title: {
                        display: true,
                        text: '載客人數',
                        color: getCssVar('--color-text-primary', '#292524'),
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });
}

/**
 * Update YoY Comparison Chart
 * Shows year-over-year passenger count comparison
 */
function updateYoYComparisonChart() {
    const ctx = document.getElementById('yoy-comparison-chart');
    if (!ctx) return;

    if (AppState.charts.yoyComparison) {
        AppState.charts.yoyComparison.destroy();
    }

    // Aggregate data by year and month
    const dataByYearMonth = new Map();

    AppState.filteredData.forEach(record => {
        const key = `${record.year}-${String(record.month).padStart(2, '0')}`;
        dataByYearMonth.set(key, (dataByYearMonth.get(key) || 0) + record.passengers);
    });

    // Sort keys chronologically
    const sortedKeys = Array.from(dataByYearMonth.keys()).sort();

    // Calculate YoY changes
    const yoyData = [];
    const labels = [];

    sortedKeys.forEach(yearMonth => {
        const [year, month] = yearMonth.split('-');
        const prevYear = parseInt(year) - 1;
        const prevYearMonth = `${prevYear}-${month}`;

        if (dataByYearMonth.has(prevYearMonth)) {
            const passengers = dataByYearMonth.get(yearMonth);
            const prevPassengers = dataByYearMonth.get(prevYearMonth);
            const yoyChange = ((passengers - prevPassengers) / prevPassengers * 100).toFixed(2);
            yoyData.push(parseFloat(yoyChange));
            labels.push(yearMonth);
        }
    });

    // Create gradient colors
    const backgroundColors = yoyData.map(val =>
        val >= 0 ? 'rgba(22, 163, 74, 0.7)' : 'rgba(220, 38, 38, 0.7)'
    );
    const borderColors = yoyData.map(val =>
        val >= 0 ? 'rgba(22, 163, 74, 1)' : 'rgba(220, 38, 38, 1)'
    );

    AppState.charts.yoyComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'YoY 變化率',
                data: yoyData,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#292524',
                    bodyColor: '#57534e',
                    borderColor: '#e7e5e4',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            const value = context.parsed.y;
                            const sign = value >= 0 ? '+' : '';
                            return `YoY: ${sign}${value}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: getCssVar('--color-border', '#e7e5e4'),
                        borderColor: getCssVar('--color-border', '#e7e5e4')
                    },
                    ticks: {
                        color: getCssVar('--color-text-secondary', '#57534e'),
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: getCssVar('--color-border', '#e7e5e4'),
                        borderColor: getCssVar('--color-border', '#e7e5e4')
                    },
                    ticks: {
                        color: getCssVar('--color-text-secondary', '#57534e'),
                        callback: function (value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: 'YoY 變化率 (%)',
                        color: getCssVar('--color-text-primary', '#292524'),
                        font: { weight: 'bold' }
                    }
                }
            }
        }
    });
}

/**
 * Update Airline Share Chart
 * Shows market share of airlines in a doughnut chart
 */
function updateAirlineShareChart() {
    const ctx = document.getElementById('airline-share-chart');
    if (!ctx) return;

    // Ensure events are bound
    initChartEvents();

    if (AppState.charts.airlineShare) {
        AppState.charts.airlineShare.destroy();
    }

    // Aggregate data
    const airlineStats = {};
    let totalVal = 0;

    AppState.filteredData.forEach(record => {
        const airline = record.airline;
        const val = currentShareMetric === 'passengers' ? record.passengers : record.flights;

        if (!airlineStats[airline]) {
            airlineStats[airline] = 0;
        }
        airlineStats[airline] += val;
        totalVal += val;
    });

    if (totalVal === 0) {
        // Render a placeholder or clear
        return;
    }

    // Sort and limit to top 5, rest to "Others"
    const sortedAirlines = Object.entries(airlineStats)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const chartData = [];
    const chartLabels = [];
    const chartColors = [];

    const maxItems = 5;
    let othersSum = 0;

    sortedAirlines.forEach((item, idx) => {
        if (idx < maxItems) {
            chartData.push(item.value);
            chartLabels.push(item.name);
            const color = window.getAirlineColor ? window.getAirlineColor(item.name, idx) : '#3b82f6';
            chartColors.push(color);
        } else {
            othersSum += item.value;
        }
    });

    if (othersSum > 0) {
        chartData.push(othersSum);
        chartLabels.push('其他');
        chartColors.push('#94a3b8'); // Gray for others
    }

    AppState.charts.airlineShare = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: 1,
                borderColor: getCssVar('--color-card-bg', '#ffffff')
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 800,
                easing: 'easeInOutQuart'
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getCssVar('--color-text-primary', '#292524'),
                        font: { size: 11 },
                        usePointStyle: true,
                        boxWidth: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#292524',
                    bodyColor: '#57534e',
                    borderColor: '#e7e5e4',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function (context) {
                            const val = context.parsed;
                            const pct = totalVal ? (val / totalVal * 100).toFixed(1) : 0;
                            const unit = currentShareMetric === 'passengers' ? '人次' : '班次';
                            return ` ${context.label}: ${val.toLocaleString()} ${unit} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
