/**
 * Data Table Rendering Functions
 * Handles airline tabs, pagination, sorting, and detailed monthly data table.
 * Designed to support both Browser dynamic updates and Node.js SSG pre-rendering.
 */

// Table State Management
const TableState = {
    currentPage: 1,
    pageSize: 20,
    currentSort: {
        column: 'yearMonth', // 'yearMonth', 'airline', 'flights', 'totalSeats', 'passengers', 'loadFactor'
        direction: 'desc'
    },
    currentAirlineFilter: null,
    headersInitialized: false
};

/**
 * Initialize table headers for sorting
 */
function initTableHeaders() {
    if (typeof window === 'undefined') return;
    const table = document.getElementById('data-table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    const sortColumns = ['yearMonth', 'airline', 'flights', 'totalSeats', 'passengers', 'loadFactor'];

    headers.forEach((th, idx) => {
        const colName = sortColumns[idx];
        if (!colName) return;

        th.classList.add('sortable-th');
        th.dataset.sort = colName;

        // Clear existing sort icons if any
        const existingIcon = th.querySelector('.sort-icon');
        if (existingIcon) existingIcon.remove();

        // Add sort icon container
        const iconSpan = document.createElement('span');
        iconSpan.className = 'sort-icon';
        th.appendChild(iconSpan);

        // Add click listener
        th.addEventListener('click', () => {
            handleHeaderClick(colName);
        });
    });

    TableState.headersInitialized = true;
}

/**
 * Handle table header click to sort
 */
function handleHeaderClick(column) {
    if (TableState.currentSort.column === column) {
        TableState.currentSort.direction = TableState.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        TableState.currentSort.column = column;
        TableState.currentSort.direction = 'desc'; // Default to descending
        if (column === 'airline' || column === 'yearMonth') {
            TableState.currentSort.direction = 'asc'; // Default alphabetical to ascending
        }
    }

    TableState.currentPage = 1; // Reset to page 1 on sort change
    updateDataTable();
}

/**
 * Update the visual state of sorting icons in the table header
 */
function updateHeaderIcons() {
    if (typeof window === 'undefined') return;
    const table = document.getElementById('data-table');
    if (!table) return;

    const headers = table.querySelectorAll('thead th');
    headers.forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '';

        if (th.dataset.sort === TableState.currentSort.column) {
            const dir = TableState.currentSort.direction;
            th.classList.add(dir === 'asc' ? 'sort-asc' : 'sort-desc');
            if (icon) {
                icon.textContent = dir === 'asc' ? ' ▲' : ' ▼';
            }
        }
    });
}

/**
 * Update airline tabs
 */
function updateAirlineTabs() {
    const tabsContainer = document.getElementById('airline-tabs');
    if (!tabsContainer) return;

    // Hide tabs container entirely if currently on an airline-specific subpage
    if (typeof AppState !== 'undefined' && AppState.selectedAirline) {
        tabsContainer.style.display = 'none';
        return;
    } else {
        tabsContainer.style.display = 'flex';
    }

    // Get unique airlines from filtered data
    const airlines = new Set();
    AppState.filteredData.forEach(record => airlines.add(record.airline));

    // Clear existing tabs
    tabsContainer.innerHTML = '';

    // Add "All" tab
    const allTab = createTab('all', '全部', TableState.currentAirlineFilter === null);
    tabsContainer.appendChild(allTab);

    // Add airline tabs
    [...airlines].sort().forEach(airline => {
        const isActive = TableState.currentAirlineFilter === airline;
        const tab = createTab(airline, airline, isActive);
        tabsContainer.appendChild(tab);
    });
}

/**
 * Create a tab element
 */
function createTab(value, label, isActive) {
    const tab = document.createElement('button');
    tab.className = `tab${isActive ? ' active' : ''}`;
    tab.dataset.airline = value;
    tab.textContent = label;

    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Update state and refresh
        TableState.currentAirlineFilter = value === 'all' ? null : value;
        TableState.currentPage = 1;
        updateDataTable();
    });

    return tab;
}

/**
 * Update data table (filters, sorts, and paginates)
 */
function updateDataTable(selectedAirline = undefined) {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    // Initialize headers if they haven't been configured yet
    if (typeof window !== 'undefined' && !TableState.headersInitialized) {
        initTableHeaders();
    }

    // Update state if passed explicitly
    if (selectedAirline !== undefined) {
        TableState.currentAirlineFilter = selectedAirline;
    }

    const airline = TableState.currentAirlineFilter;

    // Handle redirect banner for airline subpages
    const tabsContainer = document.getElementById('airline-tabs');
    if (tabsContainer) {
        let banner = document.getElementById('airline-redirect-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'airline-redirect-banner';
            banner.style.margin = 'var(--space-3) 0';
            banner.style.padding = 'var(--space-3) var(--space-4)';
            banner.style.background = 'var(--color-bg-elevated)';
            banner.style.border = '1px dashed var(--color-primary-light)';
            banner.style.borderRadius = 'var(--radius-md)';
            banner.style.fontSize = '0.85rem';
            banner.style.color = 'var(--color-text-secondary)';
            banner.style.display = 'none';
            tabsContainer.parentNode.insertBefore(banner, tabsContainer.nextSibling);
        }

        if (airline) {
            const slugMap = { '中華': 'cal', '長榮': 'eva', '星宇': 'starlux', '台灣虎航': 'tiger' };
            const slug = slugMap[airline];
            if (slug) {
                const fullName = (typeof airlineFullNames !== 'undefined' ? airlineFullNames[airline] : null) || airline;
                banner.innerHTML = `💡 您正在查看大盤中的 ${fullName} 數據。這裡有專為其設計的：<a href="/airline/${slug}/" style="color: var(--color-primary); font-weight: 600; text-decoration: none; border-bottom: 1px solid var(--color-primary);">📈 ${fullName} 獨立分析儀表板與航線市佔率分析 ➔</a>`;
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        } else {
            banner.style.display = 'none';
        }
    }

    // 1. Filter by selected airline if specified
    let dataToShow = AppState.filteredData;
    if (airline) {
        dataToShow = AppState.filteredData.filter(r => r.airline === airline);
    }

    // Clear table body
    tableBody.innerHTML = '';

    // Check if there's data
    if (dataToShow.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading-cell">沒有符合條件的數據</td></tr>';
        renderPagination(0);
        return;
    }

    // 2. Aggregate data by yearMonth and airline
    const aggregatedData = new Map();
    dataToShow.forEach(record => {
        const key = `${record.yearMonth}-${record.airline}`;

        if (!aggregatedData.has(key)) {
            aggregatedData.set(key, {
                yearMonth: record.yearMonth,
                airline: record.airline,
                flights: 0,
                totalSeats: 0,
                passengers: 0
            });
        }

        const agg = aggregatedData.get(key);
        agg.flights += record.flights;
        agg.totalSeats += record.totalSeats;
        agg.passengers += record.passengers;
    });

    const rows = Array.from(aggregatedData.values());

    // 3. Sort data based on TableState
    const col = TableState.currentSort.column;
    const dir = TableState.currentSort.direction === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
        let valA, valB;

        if (col === 'yearMonth') {
            valA = a.yearMonth;
            valB = b.yearMonth;
        } else if (col === 'airline') {
            valA = a.airline;
            valB = b.airline;
        } else if (col === 'flights') {
            valA = a.flights;
            valB = b.flights;
        } else if (col === 'totalSeats') {
            valA = a.totalSeats;
            valB = b.totalSeats;
        } else if (col === 'passengers') {
            valA = a.passengers;
            valB = b.passengers;
        } else if (col === 'loadFactor') {
            valA = a.totalSeats ? (a.passengers / a.totalSeats) : 0;
            valB = b.totalSeats ? (b.passengers / b.totalSeats) : 0;
        }

        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });

    const totalRows = rows.length;
    let rowsToRender = rows;

    const isBrowser = typeof window !== 'undefined';

    // 4. Paginate (Only in browser, Node.js outputs all rows for SEO)
    if (isBrowser && TableState.pageSize !== Infinity) {
        const totalPages = Math.ceil(totalRows / TableState.pageSize) || 1;
        if (TableState.currentPage > totalPages) {
            TableState.currentPage = totalPages;
        }
        const startIndex = (TableState.currentPage - 1) * TableState.pageSize;
        rowsToRender = rows.slice(startIndex, startIndex + TableState.pageSize);
    }

    // 5. Render rows to DOM
    rowsToRender.forEach(row => {
        const loadFactor = row.totalSeats > 0
            ? (row.passengers / row.totalSeats * 100).toFixed(2)
            : '0.00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="年月">${row.yearMonth}</td>
            <td data-label="航空公司">${row.airline}</td>
            <td data-label="航班數">${row.flights.toLocaleString()}</td>
            <td data-label="總座位數">${row.totalSeats.toLocaleString()}</td>
            <td data-label="載客人數">${row.passengers.toLocaleString()}</td>
            <td data-label="載客率">
                <span class="load-factor-badge" style="background: ${getLoadFactorColor(loadFactor)}">
                    ${loadFactor}%
                </span>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Handle Pagination and Header Icons in Browser
    if (isBrowser) {
        renderPagination(totalRows);
        updateHeaderIcons();
        addLoadFactorBadgeStyles();
    }
}

/**
 * Render pagination controls in the browser
 */
function renderPagination(totalRows) {
    if (typeof window === 'undefined') return;

    let paginationContainer = document.getElementById('table-pagination');
    if (!paginationContainer) {
        const tableCard = document.querySelector('.table-card');
        if (!tableCard) return;
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'table-pagination';
        paginationContainer.className = 'pagination';
        tableCard.appendChild(paginationContainer);
    }

    const totalPages = Math.ceil(totalRows / TableState.pageSize) || 1;

    if (totalRows === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    paginationContainer.innerHTML = `
        <button class="btn-page" id="btn-prev" ${TableState.currentPage === 1 ? 'disabled' : ''}>上一頁</button>
        <span class="page-info">第 <strong>${TableState.currentPage}</strong> / ${totalPages} 頁 (共 ${totalRows} 筆)</span>
        <button class="btn-page" id="btn-next" ${TableState.currentPage === totalPages ? 'disabled' : ''}>下一頁</button>
    `;

    document.getElementById('btn-prev')?.addEventListener('click', () => {
        if (TableState.currentPage > 1) {
            TableState.currentPage--;
            updateDataTable();
        }
    });

    document.getElementById('btn-next')?.addEventListener('click', () => {
        if (TableState.currentPage < totalPages) {
            TableState.currentPage++;
            updateDataTable();
        }
    });
}

/**
 * Get color based on load factor percentage
 */
function getLoadFactorColor(loadFactor) {
    const value = parseFloat(loadFactor);

    if (value >= 85) {
        return 'linear-gradient(135deg, #16a34a, #15803d)'; // Green
    } else if (value >= 70) {
        return 'linear-gradient(135deg, #2563eb, #1d4ed8)'; // Blue
    } else if (value >= 50) {
        return 'linear-gradient(135deg, #ca8a04, #a16207)'; // Amber
    } else {
        return 'linear-gradient(135deg, #dc2626, #b91c1c)'; // Red
    }
}

/**
 * Add styles for load factor badge
 */
function addLoadFactorBadgeStyles() {
    if (document.getElementById('load-factor-badge-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'load-factor-badge-styles';
    style.textContent = `
        .load-factor-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 2rem;
            color: white;
            font-weight: 600;
            font-size: 0.9rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            min-width: 60px;
            text-align: center;
        }
    `;
    document.head.appendChild(style);
}
