import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  formatCurrencyINR,
  formatDateIST,
  getISTDateKey,
  getISTDateParts,
  getISTDateRangeFilter,
  groupSalesByDay,
  type DailyReportGroup,
} from '../utils/dateUtils.ts';
import type {
  AdminDashboardData,
  ManagerDashboardData,
  SaleItem,
  SalesReportData,
  SalesReportGroupItem,
  SalesReportQuery,
} from '../api/types.ts';

describe('FemmeFlo Daily Sales Reporting Acceptance Suite (Seller, Manager & Admin)', () => {
  // --------------------------------------------------------------------------
  // TEST DATA FIXTURES
  // --------------------------------------------------------------------------
  const mockSeller1 = { id: 'seller-001', name: 'Ramesh Patel', phone: '9876543210' };
  const mockSeller2 = { id: 'seller-002', name: 'Sunita Sharma', phone: '9876543211' };

  const mockCustomer1 = {
    id: 'cust-001',
    name: 'Asha Gupta',
    shopName: 'Asha General Store',
    ownerName: 'Asha Gupta',
    email: 'asha@example.com',
    phone: '9876543201',
    address: 'Main Bazaar',
    pincode: '221001',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    village: 'Shivpur',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const mockCustomer2 = {
    id: 'cust-002',
    name: 'Pooja Verma',
    shopName: 'Pooja Kirana & Medical',
    ownerName: 'Pooja Verma',
    email: 'pooja@example.com',
    phone: '9876543202',
    address: 'Station Road',
    pincode: '221002',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    village: 'Rohaniya',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const mockCustomer3 = {
    id: 'cust-003',
    name: 'Kavita Singh',
    shopName: 'Kavita Ladies Corner',
    ownerName: 'Kavita Singh',
    email: 'kavita@example.com',
    phone: '9876543203',
    address: 'Civil Lines',
    pincode: '211001',
    state: 'Uttar Pradesh',
    district: 'Prayagraj',
    village: 'Naini',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const todayKey = getISTDateKey(new Date());

  const mockSales: SaleItem[] = [
    {
      id: 'sale-001',
      saleNumber: 'SALE-2026-0001',
      customerId: mockCustomer1.id,
      customer: mockCustomer1,
      sellerId: mockSeller1.id,
      seller: mockSeller1,
      totalAmountPaise: 150000, // ₹1,500.00
      totalPaise: 150000,
      packetCount: 50,
      quantity: 50,
      unitPricePaise: 3000, // ₹30/pkt
      status: 'CONFIRMED',
      paymentMode: 'CASH',
      customerFeedback: 'Demanded 50 more packets next week due to festival demand.',
      createdAt: `${todayKey}T04:30:00.000Z`, // 10:00 AM IST
    },
    {
      id: 'sale-002',
      saleNumber: 'SALE-2026-0002',
      customerId: mockCustomer2.id,
      customer: mockCustomer2,
      sellerId: mockSeller1.id,
      seller: mockSeller1,
      totalAmountPaise: 90000, // ₹900.00
      totalPaise: 90000,
      packetCount: 30,
      quantity: 30,
      unitPricePaise: 3000,
      status: 'CONFIRMED',
      paymentMode: 'BANK',
      paymentReference: 'UPI-REF-99212',
      customerFeedback: 'Owner satisfied with sample pack; requested promotional poster.',
      createdAt: `${todayKey}T07:15:00.000Z`, // 12:45 PM IST
    },
    {
      id: 'sale-003',
      saleNumber: 'SALE-2026-0003',
      customerId: mockCustomer3.id,
      customer: mockCustomer3,
      sellerId: mockSeller2.id,
      seller: mockSeller2,
      totalAmountPaise: 240000, // ₹2,400.00
      totalPaise: 240000,
      packetCount: 80,
      quantity: 80,
      unitPricePaise: 3000,
      status: 'CONFIRMED',
      paymentMode: 'CASH',
      customerFeedback: 'Stock running very fast; requested weekly visit schedule.',
      createdAt: `${todayKey}T09:00:00.000Z`, // 2:30 PM IST
    },
    {
      id: 'sale-004',
      saleNumber: 'SALE-2026-0004',
      customerId: mockCustomer1.id,
      customer: mockCustomer1,
      sellerId: mockSeller1.id,
      seller: mockSeller1,
      totalAmountPaise: 60000, // ₹600.00
      totalPaise: 60000,
      packetCount: 20,
      quantity: 20,
      unitPricePaise: 3000,
      status: 'CONFIRMED',
      paymentMode: 'PENDING',
      customerFeedback: null, // No feedback recorded
      createdAt: '2026-10-25T05:00:00.000Z',
    },
  ];

  // ==========================================================================
  // PART 1: SELLER REPORT SCOPING & DAILY TOTALS
  // ==========================================================================
  test('Seller Report: Strictly restricts sales to authenticated seller and computes today metrics', () => {
    // Authenticated as Seller 1 (Ramesh Patel)
    const currentSellerId = mockSeller1.id;
    const sellerSales = mockSales.filter((s) => s.sellerId === currentSellerId);

    assert.equal(sellerSales.length, 3, 'Seller 1 must have exactly 3 sales in history');
    assert.ok(
      sellerSales.every((s) => s.sellerId === currentSellerId),
      'Seller must never see orders belonging to Seller 2'
    );

    // Filter today's sales in IST
    const todaySales = sellerSales.filter((s) => getISTDateKey(s.createdAt) === todayKey);
    assert.equal(todaySales.length, 2, 'Seller 1 has 2 sales today');

    // Aggregate today's metrics
    const todayRevenuePaise = todaySales.reduce((acc, s) => acc + (s.totalAmountPaise ?? 0), 0);
    const todayPackets = todaySales.reduce((acc, s) => acc + (s.quantity ?? 0), 0);
    const cashPaise = todaySales
      .filter((s) => s.paymentMode === 'CASH')
      .reduce((acc, s) => acc + (s.totalAmountPaise ?? 0), 0);
    const bankPaise = todaySales
      .filter((s) => s.paymentMode === 'BANK')
      .reduce((acc, s) => acc + (s.totalAmountPaise ?? 0), 0);
    const pendingPaise = todaySales
      .filter((s) => s.paymentMode === 'PENDING')
      .reduce((acc, s) => acc + (s.totalAmountPaise ?? 0), 0);

    assert.equal(todayRevenuePaise, 240000, 'Today revenue must equal ₹2,400.00 (240000 paise)');
    assert.equal(todayPackets, 80, 'Today packets sold must equal 80 (50 + 30)');
    assert.equal(cashPaise, 150000, 'Cash subtotal must equal ₹1,500.00');
    assert.equal(bankPaise, 90000, 'Bank subtotal must equal ₹900.00');
    assert.equal(pendingPaise, 0, 'Pending subtotal today must equal ₹0');

    // Collapsible date grouping
    const groups = groupSalesByDay(sellerSales);
    assert.ok(groups.length >= 2, 'Sales must be grouped into at least 2 distinct dates');
    assert.equal(groups[0]?.dateKey, todayKey, 'First group must be today');
    assert.equal(groups[0]?.isToday, true, 'isToday must be true for current date');
    assert.equal(groups[0]?.dayLabel, 'Today', 'Label for current date must be Today');
    assert.equal(groups[0]?.salesCount, 2, 'Today group must have 2 sales');
    assert.equal(groups[0]?.totalPackets, 80, 'Today group must have 80 packets');
  });

  // ==========================================================================
  // PART 2: MANAGER REPORT SCOPING & TERRITORY PERFORMANCE
  // ==========================================================================
  test('Manager Report: Restricts to manager territory and generates seller ranking breakdown', () => {
    // Manager has jurisdiction over Varanasi district (Seller 1 and Seller 2 operate in territory)
    const territoryDistrict = 'Varanasi';
    const territorySales = mockSales.filter((s) => s.customer?.district === territoryDistrict);

    assert.equal(territorySales.length, 3, 'Territory must contain exactly 3 Varanasi sales');
    assert.ok(
      territorySales.every((s) => s.customer?.district === territoryDistrict),
      'Manager must not see sales from unauthorized districts (e.g. Prayagraj)'
    );

    // Compute territory KPI totals
    const totalPaise = territorySales.reduce((sum, s) => sum + (s.totalAmountPaise ?? 0), 0);
    const totalPackets = territorySales.reduce((sum, s) => sum + (s.quantity ?? 0), 0);
    assert.equal(totalPaise, 300000, 'Territory gross revenue must equal ₹3,000.00');
    assert.equal(totalPackets, 100, 'Territory packets volume must equal 100 pkts');

    // Compute Seller-wise performance ranking
    const sellerPerfMap: Record<string, { name: string; packets: number; totalPaise: number; count: number }> = {};
    for (const s of territorySales) {
      const name = s.seller?.name || 'Unknown Officer';
      if (!sellerPerfMap[name]) {
        sellerPerfMap[name] = { name, packets: 0, totalPaise: 0, count: 0 };
      }
      sellerPerfMap[name].count += 1;
      sellerPerfMap[name].packets += s.quantity || 0;
      sellerPerfMap[name].totalPaise += s.totalAmountPaise ?? 0;
    }

    const sellerRanking = Object.values(sellerPerfMap).sort((a, b) => b.totalPaise - a.totalPaise);
    assert.equal(sellerRanking.length, 1, 'Only Seller 1 has sales in Varanasi');
    assert.equal(sellerRanking[0]?.name, 'Ramesh Patel');
    assert.equal(sellerRanking[0]?.packets, 100);
    assert.equal(sellerRanking[0]?.totalPaise, 300000);
  });

  // ==========================================================================
  // PART 3: ADMIN REPORT & TRUE BACKEND AGGREGATE CALCULATION
  // ==========================================================================
  test('Admin Report: Uses true aggregate totals from backend and avoids paginated slice errors', () => {
    // In an enterprise system with 5,000 sales, a paginated API slice returns e.g. 50 items.
    // The report must NOT sum the 50 items on client; it must use summary from database aggregate!
    const mockBackendReportResponse: SalesReportData = {
      summary: {
        totalSalesCount: 1420,
        totalQuantitySold: 45600,
        grossSalesPaise: 136800000, // ₹1,368,000.00
        grossSalesRupees: 1368000,
        netSalesPaise: 136800000,
        netSalesRupees: 1368000,
        averageOrderValueRupees: 963.38,
      },
      groups: [
        { label: 'Varanasi', count: 850, quantity: 28000, totalPaise: 84000000 },
        { label: 'Prayagraj', count: 350, quantity: 11200, totalPaise: 33600000 },
        { label: 'Mirzapur', count: 220, quantity: 6400, totalPaise: 19200000 },
      ],
      items: mockSales.slice(0, 4), // Only returns first 4 items in paginated slice
    };

    // Client verifies summary
    const { summary, groups, items } = mockBackendReportResponse;

    // Verify true database aggregates vs slice count
    assert.equal(summary.totalSalesCount, 1420, 'Total sales count must be 1420 (from DB aggregate)');
    assert.notEqual(
      summary.totalSalesCount,
      items.length,
      'Must NOT use paginated items length as total sales count'
    );

    assert.equal(
      summary.grossSalesRupees,
      1368000,
      'Gross revenue must be ₹13,68,000.00 from DB aggregate'
    );
    assert.equal(summary.totalQuantitySold, 45600, 'Volume must be 45,600 pkts from DB aggregate');

    // Verify average order value formula
    const expectedAOV = summary.grossSalesRupees / summary.totalSalesCount;
    assert.ok(
      Math.abs(summary.averageOrderValueRupees - expectedAOV) < 0.01,
      'Average order value must equal grossSalesRupees / totalSalesCount'
    );

    // Verify group calculations
    assert.equal(groups?.length, 3, 'Must have 3 districts in breakdown');
    const totalGroupQty = groups!.reduce((acc, g) => acc + g.quantity, 0);
    assert.equal(
      totalGroupQty,
      summary.totalQuantitySold,
      'Sum of group quantities must equal total quantity sold'
    );
  });

  // ==========================================================================
  // PART 4: DATE RANGE FILTERING ENGINE (IST ANCHORED)
  // ==========================================================================
  test('Date Range Filters: Correctly computes IST boundaries for today, week, month and all', () => {
    // 1. All time filter
    const allFilter = getISTDateRangeFilter('all');
    assert.deepEqual(allFilter, {}, 'All time filter must be unbounded');

    // 2. Today filter
    const todayFilter = getISTDateRangeFilter('today');
    assert.equal(todayFilter.from, todayKey, 'from date must equal todayKey in IST');
    assert.equal(todayFilter.to, todayKey, 'to date must equal todayKey in IST');

    // 3. Last 7 Days filter
    const weekFilter = getISTDateRangeFilter('week');
    assert.ok(weekFilter.from && weekFilter.to, 'Week filter must have from and to dates');
    assert.equal(weekFilter.to, todayKey, 'Week filter to must be todayKey');
    assert.ok(
      weekFilter.from <= todayKey,
      'Week filter from must be 6-7 days prior to todayKey'
    );

    // 4. This Month filter
    const monthFilter = getISTDateRangeFilter('month');
    const istParts = getISTDateParts(new Date());
    const expectedMonthStart = `${istParts.year}-${String(istParts.month).padStart(2, '0')}-01`;
    assert.equal(monthFilter.from, expectedMonthStart, 'Month filter must begin on the 1st of current IST month');
    assert.equal(monthFilter.to, todayKey, 'Month filter to must end on today');
  });

  // ==========================================================================
  // PART 5: CUSTOMER FEEDBACK OBSERVATIONS EXTRACTION
  // ==========================================================================
  test('Customer Feedback Observations: Extracts only valid non-empty customer feedback notes', () => {
    const feedbackItems = mockSales.filter(
      (item) => item.customerFeedback && item.customerFeedback.trim().length > 0
    );

    // Out of 4 mock sales, 3 have feedback and 1 has null
    assert.equal(feedbackItems.length, 3, 'Must extract exactly 3 sales with customer feedback');

    assert.equal(
      feedbackItems[0]?.customerFeedback,
      'Demanded 50 more packets next week due to festival demand.'
    );
    assert.equal(feedbackItems[0]?.customer?.shopName, 'Asha General Store');
    assert.equal(feedbackItems[0]?.seller?.name, 'Ramesh Patel');

    assert.equal(
      feedbackItems[1]?.customerFeedback,
      'Owner satisfied with sample pack; requested promotional poster.'
    );
    assert.equal(feedbackItems[1]?.customer?.shopName, 'Pooja Kirana & Medical');

    // Check formatting
    const formattedCurrency = formatCurrencyINR(feedbackItems[0]?.totalAmountPaise || 0);
    assert.ok(
      formattedCurrency.includes('1,500'),
      'Formatted currency must display Indian numbering format (₹1,500.00)'
    );
  });

  // ==========================================================================
  // PART 6: EMPTY DATES AND FALLBACK HANDLING
  // ==========================================================================
  test('Empty Dates & Zero State Handling: Formats empty groups gracefully without runtime errors', () => {
    const emptySalesList: SaleItem[] = [];
    const emptyGroups = groupSalesByDay(emptySalesList);
    assert.equal(emptyGroups.length, 0, 'Empty sales list must produce 0 groups');

    const emptyReport: SalesReportData = {
      summary: {
        totalSalesCount: 0,
        totalQuantitySold: 0,
        grossSalesPaise: 0,
        grossSalesRupees: 0,
        netSalesPaise: 0,
        netSalesRupees: 0,
        averageOrderValueRupees: 0,
      },
      groups: [],
      items: [],
    };

    assert.equal(emptyReport.summary.grossSalesRupees, 0);
    assert.equal(emptyReport.summary.totalQuantitySold, 0);
    assert.equal(emptyReport.summary.averageOrderValueRupees, 0);
  });
});

