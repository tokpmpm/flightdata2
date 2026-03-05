/**
 * Main Application Logic
 * Handles data loading, filtering, and coordination between components
 */

// Global state
const AppState = {
    rawData: [],
    filteredData: [],
    airports: new Set(),
    destinations: new Map(), // airport -> Set of destinations
    airlines: new Set(),
    dateRange: {
        startYear: 2024,
        startMonth: 1,
        endYear: 2025,
        endMonth: 10
    },
    selectedAirport: '',
    selectedDestination: '',
    charts: {}
};

/**
 * Initialize the application
 */
async function initApp() {
    console.log('Initializing application...');

    try {
        // Load data
        await loadData();

        // Initialize filters
        initializeFilters();

        // Set up event listeners
        setupEventListeners();

        // Initial render
        updateDashboard();

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('無法載入數據，請檢查數據文件是否存在');
    }
}

/**
 * Load flight data from JSON file
 */
async function loadData() {
    try {
        if (typeof flightData !== 'undefined') {
            console.log('Using flightData from JS file');
            const flat = [];
            // flightData structure: { "所有": { "Airport": { "Destination": { "Airline": [records] } } } }
            const all = flightData["所有"] || {};

            for (const airportName in all) {
                const destinations = all[airportName];
                for (const destination in destinations) {
                    const airlines = destinations[destination];
                    for (const airlineName in airlines) {
                        const records = airlines[airlineName];
                        if (!Array.isArray(records)) {
                            console.warn(`Skipping invalid records for ${airlineName} in ${airportName}/${destination}:`, records);
                            continue;
                        }
                        for (const rec of records) {
                            flat.push({
                                year: rec.year,
                                month: rec.month,
                                yearMonth: `${rec.year}-${String(rec.month).padStart(2, '0')}`,
                                airport: airportName,
                                destination,
                                airline: airlineName,
                                flights: rec.flights,
                                totalSeats: rec.seats,
                                passengers: rec.passengers,
                                loadFactor: rec.seats ? (rec.passengers / rec.seats) * 100 : 0
                            });
                        }
                    }
                }
            }
            AppState.rawData = processRawData(flat);

            // Set default date range to latest available
            if (AppState.rawData.length > 0) {
                const sorted = [...AppState.rawData].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
                const latest = sorted[0];
                AppState.dateRange.endYear = latest.year;
                AppState.dateRange.endMonth = latest.month;

                // Default start to 2024-1 as requested
                AppState.dateRange.startYear = 2024;
                AppState.dateRange.startMonth = 1;
            }

            console.log(`Loaded ${AppState.rawData.length} records`);
        } else {
            throw new Error('flightData not found');
        }
        extractFilterOptions();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('無法載入數據，請檢查數據文件是否存在');
        throw error; // Re-throw to stop initApp
    }
}

/**
 * Process raw data into standardized format
 */
function processRawData(rawData) {
    return rawData.map(record => ({
        ...record,
        // Ensure numeric types
        flights: Number(record.flights),
        totalSeats: Number(record.totalSeats),
        passengers: Number(record.passengers),
        loadFactor: Number(record.loadFactor)
    }));
}

/**
 * Extract unique values for filter dropdowns
 */
function extractFilterOptions() {
    AppState.airports.clear();
    AppState.destinations.clear();
    AppState.airlines.clear();

    AppState.rawData.forEach(record => {
        AppState.airports.add(record.airport);
        AppState.airlines.add(record.airline);

        if (!AppState.destinations.has(record.airport)) {
            AppState.destinations.set(record.airport, new Set());
        }
        AppState.destinations.get(record.airport).add(record.destination);
    });
}

/**
 * Initialize filter dropdowns
 */
function initializeFilters() {
    // Airport dropdown
    const airportSelect = document.getElementById('airport-select');
    airportSelect.innerHTML = '<option value="">全部機場</option>';

    // Sort airports to put Taoyuan first if present
    const sortedAirports = [...AppState.airports].sort((a, b) => {
        if (a.includes('桃園')) return -1;
        if (b.includes('桃園')) return 1;
        return a.localeCompare(b);
    });

    sortedAirports.forEach(airport => {
        const option = document.createElement('option');
        option.value = airport;
        option.textContent = airport;
        airportSelect.appendChild(option);
    });

    // Date dropdowns
    const years = [...new Set(AppState.rawData.map(d => d.year))].sort((a, b) => a - b);
    const minYear = years[0] || 2022;
    const maxYear = years[years.length - 1] || 2025;

    const populateSelect = (id, start, end, selected) => {
        const select = document.getElementById(id);
        if (!select) {
            console.error(`Element with id ${id} not found`);
            return;
        }
        select.innerHTML = '';
        for (let i = start; i <= end; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            if (i === selected) option.selected = true;
            select.appendChild(option);
        }
    };

    populateSelect('start-year', minYear, maxYear, AppState.dateRange.startYear);
    populateSelect('end-year', minYear, maxYear, AppState.dateRange.endYear);
    populateSelect('start-month', 1, 12, AppState.dateRange.startMonth);
    populateSelect('end-month', 1, 12, AppState.dateRange.endMonth);

    // Initial destination update
    updateDestinationDropdown('');
}

/**
 * Update destination dropdown based on selected airport
 */
function updateDestinationDropdown(airport) {
    const destinationSelect = document.getElementById('destination-select');
    destinationSelect.innerHTML = '<option value="">全部航點</option>';

    let destinations = new Set();
    if (airport && AppState.destinations.has(airport)) {
        destinations = AppState.destinations.get(airport);
    } else {
        // All destinations
        AppState.destinations.forEach(dests => {
            dests.forEach(d => destinations.add(d));
        });
    }

    // Group by Region/Country
    const grouped = {};
    destinations.forEach(dest => {
        const info = window.DESTINATION_MAP ? window.DESTINATION_MAP[dest] : { region: '其他', country: '其他' };
        // Fallback if DESTINATION_MAP is missing specific entry
        const region = info ? info.region : '其他';
        const country = info ? info.country : '其他';

        if (!grouped[region]) grouped[region] = {};
        if (!grouped[region][country]) grouped[region][country] = [];
        grouped[region][country].push(dest);
    });

    // Render groups
    // Order: Northeast Asia, Southeast Asia, Hong Kong/Macau/China, America, Europe, Oceania, Others
    const regionOrder = ['東北亞', '東南亞', '港澳大陸', '美洲', '歐洲', '大洋洲', '其他'];

    regionOrder.forEach(region => {
        if (grouped[region]) {
            const regionGroup = document.createElement('optgroup');
            regionGroup.label = `=== ${region} ===`;
            destinationSelect.appendChild(regionGroup);

            Object.keys(grouped[region]).sort().forEach(country => {
                // If multiple countries in region, maybe add sub-label or just list
                // HTML select doesn't support nested optgroups.
                // We will just list cities sorted by country.

                grouped[region][country].sort().forEach(dest => {
                    const option = document.createElement('option');
                    option.value = dest;
                    // Show "Country - City" if not implicit
                    option.textContent = `${country} - ${dest}`;
                    destinationSelect.appendChild(option);
                });
            });
        }
    });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Airport change
    document.getElementById('airport-select').addEventListener('change', (e) => {
        AppState.selectedAirport = e.target.value;
        updateDestinationDropdown(e.target.value);
        AppState.selectedDestination = '';
        document.getElementById('destination-select').value = '';
    });

    // Destination change
    document.getElementById('destination-select').addEventListener('change', (e) => {
        AppState.selectedDestination = e.target.value;
    });

    // Date changes
    const updateDateRange = () => {
        AppState.dateRange.startYear = parseInt(document.getElementById('start-year').value);
        AppState.dateRange.startMonth = parseInt(document.getElementById('start-month').value);
        AppState.dateRange.endYear = parseInt(document.getElementById('end-year').value);
        AppState.dateRange.endMonth = parseInt(document.getElementById('end-month').value);
    };

    ['start-year', 'start-month', 'end-year', 'end-month'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateDateRange);
    });

    // Apply filters button
    document.getElementById('apply-filters').addEventListener('click', () => {
        updateDashboard();
    });

    // Reset filters button
    document.getElementById('reset-filters').addEventListener('click', () => {
        resetFilters();
    });
}

/**
 * Reset all filters to default
 */
function resetFilters() {
    document.getElementById('airport-select').value = '';
    document.getElementById('destination-select').value = '';

    // Reset dates to initial state
    // Re-run logic to find latest date
    if (AppState.rawData.length > 0) {
        const sorted = [...AppState.rawData].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
        const latest = sorted[0];
        AppState.dateRange.endYear = latest.year;
        AppState.dateRange.endMonth = latest.month;
        AppState.dateRange.startYear = 2024;
        AppState.dateRange.startMonth = 1;

        document.getElementById('start-year').value = AppState.dateRange.startYear;
        document.getElementById('start-month').value = AppState.dateRange.startMonth;
        document.getElementById('end-year').value = AppState.dateRange.endYear;
        document.getElementById('end-month').value = AppState.dateRange.endMonth;
    }

    AppState.selectedAirport = '';
    AppState.selectedDestination = '';

    updateDestinationDropdown('');
    updateDashboard();
}

/**
 * Apply filters to data
 */
function applyFilters() {
    const start = AppState.dateRange.startYear * 100 + AppState.dateRange.startMonth;
    const end = AppState.dateRange.endYear * 100 + AppState.dateRange.endMonth;

    AppState.filteredData = AppState.rawData.filter(record => {
        // Airport filter
        if (AppState.selectedAirport && record.airport !== AppState.selectedAirport) {
            return false;
        }

        // Destination filter
        if (AppState.selectedDestination && record.destination !== AppState.selectedDestination) {
            return false;
        }

        // Date range filter
        const current = record.year * 100 + record.month;
        if (current < start || current > end) {
            return false;
        }

        return true;
    });

    console.log(`Filtered data: ${AppState.filteredData.length} records`);
}

/**
 * Update entire dashboard with filtered data
 */
function updateDashboard() {
    applyFilters();

    // Update charts
    if (window.updateLoadFactorChart) updateLoadFactorChart();
    if (window.updateStackedPassengersChart) updateStackedPassengersChart();
    if (window.updateYoYComparisonChart) updateYoYComparisonChart();

    // Update table
    if (window.updateDataTable) updateDataTable();
    if (window.updateAirlineTabs) updateAirlineTabs();
}

/**
 * Show error message
 */
function showError(message) {
    const tableBody = document.getElementById('table-body');
    if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6" class="loading-cell" style="color: var(--error-color);">${message}</td></tr>`;
    }
}

/**
 * Generate realistic Taiwan flight data
 */
function generateDemoData() {
    const data = [];

    // Real Taiwan airports
    const airports = {
        '桃園國際機場': 'TPE',
        '松山機場': 'TSA',
        '高雄國際機場': 'KHH'
    };

    // Major destinations from Taiwan
    const destinations = [
        // Japan
        { name: '東京成田', region: '日本', popularity: 0.95 },
        { name: '東京羽田', region: '日本', popularity: 0.9 },
        { name: '大阪關西', region: '日本', popularity: 0.9 },
        { name: '福岡', region: '日本', popularity: 0.75 },
        { name: '沖繩', region: '日本', popularity: 0.85 },
        { name: '名古屋', region: '日本', popularity: 0.65 },
        { name: '札幌新千歲', region: '日本', popularity: 0.7 },
        // Korea
        { name: '首爾仁川', region: '韓國', popularity: 0.9 },
        { name: '首爾金浦', region: '韓國', popularity: 0.75 },
        { name: '釜山', region: '韓國', popularity: 0.7 },
        // Southeast Asia
        { name: '曼谷素萬那普', region: '泰國', popularity: 0.8 },
        { name: '新加坡', region: '新加坡', popularity: 0.85 },
        { name: '吉隆坡', region: '馬來西亞', popularity: 0.7 },
        { name: '胡志明市', region: '越南', popularity: 0.65 },
        { name: '馬尼拉', region: '菲律賓', popularity: 0.7 },
        // Greater China
        { name: '香港', region: '香港', popularity: 0.85 },
        { name: '澳門', region: '澳門', popularity: 0.7 },
        // US & Oceania
        { name: '洛杉磯', region: '美國', popularity: 0.6 },
        { name: '舊金山', region: '美國', popularity: 0.55 },
        { name: '雪梨', region: '澳洲', popularity: 0.65 },
        { name: '墨爾本', region: '澳洲', popularity: 0.55 }
    ];

    // Major airlines
    const airlines = [
        { name: '中華航空', share: 0.25, avgLF: 82 },
        { name: '長榮航空', share: 0.25, avgLF: 84 },
        { name: '星宇航空', share: 0.12, avgLF: 86 },
        { name: '台灣虎航', share: 0.08, avgLF: 88 },
        { name: '日本航空', share: 0.05, avgLF: 80 },
        { name: '全日空', share: 0.05, avgLF: 81 },
        { name: '大韓航空', share: 0.04, avgLF: 79 },
        { name: '國泰航空', share: 0.04, avgLF: 77 },
        { name: '新加坡航空', share: 0.03, avgLF: 83 }
    ];

    // COVID recovery factors
    const covidFactors = {
        2022: 0.4,
        2023: 0.75,
        2024: 0.95,
        2025: 1.0
    };

    // Seasonal factors
    const seasonalFactors = {
        1: 1.1, 2: 1.15, 3: 0.9, 4: 0.95, 5: 0.9, 6: 1.0,
        7: 1.2, 8: 1.25, 9: 1.0, 10: 1.05, 11: 0.95, 12: 1.1
    };

    for (let year = 2022; year <= 2025; year++) {
        const maxMonth = year === 2025 ? 10 : 12;
        const recovery = covidFactors[year];

        for (let month = 1; month <= maxMonth; month++) {
            const seasonal = seasonalFactors[month];

            // Generate data for top airports
            Object.keys(airports).forEach(airport => {
                destinations.forEach(dest => {
                    // Select random airlines for this route (2-4 airlines)
                    const numAirlines = Math.floor(Math.random() * 3) + 2;
                    const routeAirlines = airlines
                        .sort(() => Math.random() - 0.5)
                        .slice(0, numAirlines);

                    routeAirlines.forEach(airline => {
                        const baseFlights = Math.floor(
                            dest.popularity * 30 * recovery * seasonal * airline.share
                        );

                        if (baseFlights === 0) return;

                        const flights = Math.max(1, baseFlights + Math.floor(Math.random() * 11) - 5);
                        const seatsPerFlight = [180, 220, 280, 320, 350][Math.floor(Math.random() * 5)];
                        const totalSeats = flights * seatsPerFlight;

                        const loadFactor = Math.min(
                            98,
                            Math.max(
                                50,
                                airline.avgLF + (Math.random() * 16 - 8) * seasonal
                            )
                        );

                        const passengers = Math.floor(totalSeats * (loadFactor / 100));

                        data.push({
                            year,
                            month,
                            yearMonth: `${year}-${String(month).padStart(2, '0')}`,
                            airport,
                            destination: dest.name,
                            airline: airline.name,
                            flights,
                            totalSeats,
                            passengers,
                            loadFactor: parseFloat(loadFactor.toFixed(2))
                        });
                    });
                });
            });
        }
    }

    return data;
}

// Airline Colors (Global)
window.AIRLINE_COLORS = {
    "長榮": "#00A651", // Green
    "立榮": "#00A651", // Green
    "中華": "#866699", // Purple
    "華信": "#F58220", // Orange
    "星宇": "#A38F59", // Gold
    "國泰": "#006B6E", // Teal
    "台灣虎航": "#F58220", // Orange
    "虎航": "#F58220", // Orange
    "全日空": "#183883", // Blue
    "日航": "#CC0000", // Red
    "日本航空": "#CC0000", // Red
    "韓亞": "#A68F7C", // Brownish
    "大韓": "#00349A", // Blue
    "越捷": "#ED1C24", // Red
    "越南航空": "#004C8C", // Blue
    "泰國航空": "#4D148C", // Purple
    "酷航": "#FFE600", // Yellow
    "樂桃": "#D6007F", // Pink
    "捷星": "#FF5500", // Orange
    "聯合": "#005DAA", // Blue
    "達美": "#E31837", // Red
    "荷蘭": "#00A1DE", // Blue
    "土耳其": "#E30A17", // Red
    "阿聯酋": "#D71920", // Red
    "香港": "#D21F2F", // Red
    "澳門": "#NX", // NX? 
    "深圳": "#D71920", // Red
    "廈門": "#0085CA", // Blue
    "中國國際": "#E30A17", // Red
    "東方": "#002A5C", // Navy
    "南方": "#002A5C", // Navy
    "吉祥": "#B51F24", // Red
    "春秋": "#00A040", // Green
};

window.getAirlineColor = function (airlineName, index) {
    // Try exact match or partial match
    for (const key in window.AIRLINE_COLORS) {
        if (airlineName.includes(key)) return window.AIRLINE_COLORS[key];
    }

    // Fallback colors
    const colors = [
        '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a',
        '#0891b2', '#4f46e5', '#c026d3', '#d97706', '#059669'
    ];
    return colors[index % colors.length];
};

function updateCharts() {
    // Add resize listener for RWD (All charts)
    window.addEventListener('resize', () => {
        if (AppState.charts.loadFactor) AppState.charts.loadFactor.resize();
        if (AppState.charts.passengers) AppState.charts.passengers.resize();
        if (AppState.charts.stackedPassengers) AppState.charts.stackedPassengers.resize();
        if (AppState.charts.yoyComparison) AppState.charts.yoyComparison.resize();
    });

    const { filteredData } = AppState;

    // Process data for charts
    // Group by Month
    const monthlyData = {};
    const airlines = new Set();

    filteredData.forEach(record => {
        const dateKey = `${record.year}-${String(record.month).padStart(2, '0')}`;
        if (!monthlyData[dateKey]) {
            monthlyData[dateKey] = {};
        }

        if (!monthlyData[dateKey][record.airline]) {
            monthlyData[dateKey][record.airline] = {
                flights: 0,
                seats: 0,
                passengers: 0
            };
        }

        monthlyData[dateKey][record.airline].flights += record.flights;
        monthlyData[dateKey][record.airline].seats += record.seats;
        monthlyData[dateKey][record.airline].passengers += record.passengers;

        airlines.add(record.airline);
    });

    // Sort dates chronologically
    const labels = Object.keys(monthlyData).sort((a, b) => {
        return a.localeCompare(b);
    });

    const airlineList = Array.from(airlines);

    // Prepare datasets
    const loadFactorDatasets = airlineList.map((airline, index) => {
        const data = labels.map(date => {
            const record = monthlyData[date][airline];
            if (!record || record.seats === 0) return null;
            return ((record.passengers / record.seats) * 100).toFixed(2);
        });

        const color = getAirlineColor(airline, index);

        return {
            label: airline,
            data: data,
            borderColor: color,
            backgroundColor: color,
            tension: 0.4,
            fill: false
        };
    });

    const passengerDatasets = airlineList.map((airline, index) => {
        const data = labels.map(date => {
            const record = monthlyData[date][airline];
            return record ? record.passengers : 0;
        });

        const color = getAirlineColor(airline, index);

        return {
            label: airline,
            data: data,
            backgroundColor: color,
            stack: 'Stack 0'
        };
    });

    // Update Load Factor Chart
    const ctxLoadFactor = document.getElementById('loadFactorChart').getContext('2d');

    if (AppState.charts.loadFactor) {
        AppState.charts.loadFactor.destroy();
    }

    AppState.charts.loadFactor = new Chart(ctxLoadFactor, {
        type: 'line',
        data: {
            labels: labels,
            datasets: loadFactorDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#cbd5e1' }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' },
                    title: {
                        display: true,
                        text: '載客率 (%)',
                        color: '#cbd5e1'
                    }
                },
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });

    // Update Passengers Chart
    const ctxPassengers = document.getElementById('passengersChart').getContext('2d');

    if (AppState.charts.passengers) {
        AppState.charts.passengers.destroy();
    }

    AppState.charts.passengers = new Chart(ctxPassengers, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: passengerDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#cbd5e1' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' },
                    title: {
                        display: true,
                        text: '載客人數',
                        color: '#cbd5e1'
                    }
                },
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });

    if (window.updateDataTable) updateDataTable(monthlyData, labels, airlineList);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
