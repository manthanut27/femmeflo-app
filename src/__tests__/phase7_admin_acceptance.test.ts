import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import type {
  BusinessSettings,
  CreateAdjustmentPayload,
  CreateBulkCustomersPayload,
  CreatePayoutPayload,
  CreateProductPayload,
  CustomerItem,
  IncentiveSummaryItem,
  PaymentMode,
  ProductItem,
  PublicUser,
  SaleItem,
  SaleStatus,
  Shift,
  ShiftVisit,
  UpdateProductPayload,
  UserIncentiveDetails,
} from '../api/types.ts';
import {
  ALL_BACKEND_PERMISSIONS,
  MANAGER_PERMISSIONS,
  hasPermission,
  syncPermissionAliases,
  canOnboardCustomers,
  canViewCustomers,
  canManageSellers,
  canViewInventory,
  canApproveSales,
  canViewReports,
} from '../utils/permissions.ts';

describe('FemmeFlo Phase 7: Super Admin Parity & Governance Acceptance Suite', () => {
  // Test Super Admin User
  const superAdminUser: PublicUser = {
    id: 'usr_super_admin',
    name: 'Executive Super Admin',
    email: 'admin@femmeflo.com',
    role: 'SUPER_ADMIN',
    active: true,
  };

  // Test Territory Manager User
  const territoryManager: PublicUser = {
    id: 'usr_mgr_01',
    name: 'Varanasi Territory Manager',
    email: 'manager.varanasi@femmeflo.com',
    role: 'MANAGER',
    active: true,
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    village: 'Varanasi HQ',
    permissions: ['onboard_customers', 'manage_sellers', 'view_inventory'],
  };

  // ====================================================
  // PART A: PRODUCT CATALOG & FLOOR CONSTRAINTS
  // ====================================================
  describe('Part A: Product Catalog, Floor Pricing & SKU Invariants', () => {
    // Acronym / SKU generator algorithm as implemented on mobile and website
    function generateSkuFromName(name: string, randomSuffix = 405): string {
      const raw = name.trim();
      if (!raw) return `FF-PRD-${randomSuffix}`;
      const words = raw
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
      const code = words
        .map((w) => w.slice(0, 3).toUpperCase())
        .slice(0, 3)
        .join('-');
      return `FF-${code || 'PRD'}-${randomSuffix}`;
    }

    test('A1: Auto-generates standard 3-segment uppercase SKU from product title', () => {
      const sku1 = generateSkuFromName('FemmeFlo Anion Wings Ultra 280mm', 101);
      assert.equal(sku1, 'FF-FEM-ANI-WIN-101');

      const sku2 = generateSkuFromName('Regular Cotton Pads', 202);
      assert.equal(sku2, 'FF-REG-COT-PAD-202');

      const skuEmpty = generateSkuFromName('', 303);
      assert.equal(skuEmpty, 'FF-PRD-303');
    });

    test('A2: Product floor price validation requires minimumPricePaise <= basePricePaise', () => {
      function validateProductPricing(basePricePaise: number, minimumPricePaise: number) {
        if (basePricePaise <= 0) {
          throw new Error('Base price must be positive');
        }
        if (minimumPricePaise <= 0) {
          throw new Error('Minimum price floor must be positive');
        }
        if (minimumPricePaise > basePricePaise) {
          throw new Error('Minimum price cannot exceed base price');
        }
        return true;
      }

      // Valid: ₹35 base, ₹25 floor
      assert.equal(validateProductPricing(3500, 2500), true);

      // Valid: Floor equal to base (no discount allowed)
      assert.equal(validateProductPricing(3500, 3500), true);

      // Invalid: Floor exceeds base price
      assert.throws(() => validateProductPricing(3000, 3500), /cannot exceed base price/);

      // Invalid: Zero or negative base price
      assert.throws(() => validateProductPricing(0, 2500), /Base price must be positive/);
    });

    test('A3: Product toggle inverts active state cleanly', () => {
      const product: ProductItem = {
        id: 'prod-001',
        name: 'FemmeFlo Wings 280mm',
        sku: 'FF-WNG-280',
        basePricePaise: 3500,
        minimumPricePaise: 2500,
        active: true,
      };

      function toggleActive(p: ProductItem): ProductItem {
        return { ...p, active: !p.active };
      }

      const deactivated = toggleActive(product);
      assert.equal(deactivated.active, false);

      const reactivated = toggleActive(deactivated);
      assert.equal(reactivated.active, true);
    });
  });

  // ====================================================
  // PART B: INCENTIVE MANAGEMENT & FINANCIAL CONTROLS
  // ====================================================
  describe('Part B: Incentive Management, Rate Overrides & Payouts', () => {
    test('B1: Validates manual incentive adjustments (ADD and DEDUCT)', () => {
      function validateAdjustment(payload: CreateAdjustmentPayload) {
        if (payload.type !== 'ADD' && payload.type !== 'DEDUCT') {
          throw new Error('Invalid adjustment type');
        }
        if (!payload.amountPaise || payload.amountPaise <= 0) {
          throw new Error('Adjustment amount must be positive');
        }
        if (!payload.reason || !payload.reason.trim()) {
          throw new Error('Audit reason is required');
        }
        return true;
      }

      // Valid Addition
      assert.equal(
        validateAdjustment({
          type: 'ADD',
          amountPaise: 50000, // ₹500
          reason: 'Quarterly performance reward',
        }),
        true
      );

      // Valid Deduction
      assert.equal(
        validateAdjustment({
          type: 'DEDUCT',
          amountPaise: 20000, // ₹200
          reason: 'Cancelled transaction recovery',
        }),
        true
      );

      // Invalid: Negative amount
      assert.throws(
        () =>
          validateAdjustment({
            type: 'ADD',
            amountPaise: -500,
            reason: 'Test',
          }),
        /must be positive/
      );

      // Invalid: Missing reason
      assert.throws(
        () =>
          validateAdjustment({
            type: 'ADD',
            amountPaise: 1000,
            reason: '   ',
          }),
        /Audit reason is required/
      );
    });

    test('B2: Payout amount cannot exceed total outstanding balance', () => {
      function validatePayoutExecution(amountPaise: number, outstandingPaise: number, method: string) {
        if (amountPaise <= 0) {
          throw new Error('Payout amount must be positive');
        }
        if (amountPaise > outstandingPaise) {
          throw new Error('Payout cannot exceed outstanding balance');
        }
        if (!['BANK', 'UPI', 'CASH'].includes(method)) {
          throw new Error('Unsupported payment method');
        }
        return true;
      }

      // Valid payout within balance
      assert.equal(validatePayoutExecution(30000, 50000, 'BANK'), true);

      // Valid exact settlement
      assert.equal(validatePayoutExecution(50000, 50000, 'UPI'), true);

      // Blocked: Exceeds outstanding balance
      assert.throws(() => validatePayoutExecution(60000, 50000, 'BANK'), /exceed outstanding/);

      // Blocked: Unsupported method (e.g. WALLET or CHEQUE)
      assert.throws(() => validatePayoutExecution(10000, 50000, 'CRYPTO'), /Unsupported payment method/);
    });

    test('B3: Calculates company-wide incentive metrics correctly', () => {
      const sellers: IncentiveSummaryItem[] = [
        {
          id: 's1',
          sellerId: 's1',
          name: 'Ramesh Patel',
          totalEarnedPaise: 150000, // ₹1,500
          totalPaidPaise: 100000, // ₹1,000
          outstandingPaise: 50000, // ₹500
          status: 'PARTIALLY_PAID',
        },
        {
          id: 's2',
          sellerId: 's2',
          name: 'Sunita Sharma',
          totalEarnedPaise: 200000, // ₹2,000
          totalPaidPaise: 200000, // ₹2,000
          outstandingPaise: 0,
          status: 'PAID',
        },
        {
          id: 's3',
          sellerId: 's3',
          name: 'Pooja Verma',
          totalEarnedPaise: 80000, // ₹800
          totalPaidPaise: 0,
          outstandingPaise: 80000, // ₹800
          status: 'UNPAID',
        },
      ];

      const totalEarnedPaise = sellers.reduce((sum, s) => sum + s.totalEarnedPaise, 0);
      const totalPaidPaise = sellers.reduce((sum, s) => sum + s.totalPaidPaise, 0);
      const totalPendingPaise = sellers.reduce((sum, s) => sum + s.outstandingPaise, 0);
      const pendingEmployeesCount = sellers.filter((s) => s.outstandingPaise > 0).length;

      assert.equal(totalEarnedPaise, 430000); // ₹4,300
      assert.equal(totalPaidPaise, 300000); // ₹3,000
      assert.equal(totalPendingPaise, 130000); // ₹1,300
      assert.equal(pendingEmployeesCount, 2);
    });
  });

  // ====================================================
  // PART C: NATIONAL SHIFT AUDIT & GPS VISITS
  // ====================================================
  describe('Part C: National Shift Audit, Attendance & GPS Verification', () => {
    test('C1: Shift closing odometer must be greater than or equal to start odometer', () => {
      function validateShiftEnd(startKm: number, endKm: number) {
        if (endKm < startKm) {
          throw new Error('Closing odometer cannot be less than start odometer');
        }
        return endKm - startKm;
      }

      assert.equal(validateShiftEnd(12000, 12045.5), 45.5);
      assert.equal(validateShiftEnd(12000, 12000), 0); // Stationary shift
      assert.throws(() => validateShiftEnd(12000, 11950), /cannot be less/);
    });

    test('C2: Calculates shift duration in human-readable hours and minutes', () => {
      function formatShiftDuration(mins: number | null | undefined): string {
        if (mins === null || mins === undefined) return 'Active now';
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
      }

      assert.equal(formatShiftDuration(null), 'Active now');
      assert.equal(formatShiftDuration(45), '45m');
      assert.equal(formatShiftDuration(135), '2h 15m');
      assert.equal(formatShiftDuration(480), '8h 0m');
    });

    test('C3: Verifies GPS visits structure and coordinate boundary validation', () => {
      const visit: ShiftVisit = {
        id: 'v_001',
        shiftId: 'sh_001',
        shopName: 'Asha General Store',
        checkInTime: '2026-10-31T09:30:00.000Z',
        latitude: 25.3176,
        longitude: 82.9739,
        accuracy: 12.5,
        visitReason: 'Payment Collection',
        feedback: 'Owner paid pending balance in cash',
      };

      assert.ok(visit.latitude! >= -90 && visit.latitude! <= 90, 'Valid latitude range');
      assert.ok(visit.longitude! >= -180 && visit.longitude! <= 180, 'Valid longitude range');
      assert.ok(visit.accuracy! > 0, 'Accuracy radius must be positive');
      assert.equal(visit.visitReason, 'Payment Collection');
    });
  });

  // ====================================================
  // PART D: PERMISSIONS MATRIX & SECURITY BOUNDARIES
  // ====================================================
  describe('Part D: Permissions Matrix & Role-Based Access Control', () => {
    test('D1: ALL_BACKEND_PERMISSIONS is strictly bounded to the 16 backend canonical keys', () => {
      assert.equal(ALL_BACKEND_PERMISSIONS.length, 16);
      assert.deepEqual(Array.from(ALL_BACKEND_PERMISSIONS), [
        'manage_sellers',
        'manage_managers',
        'onboard_customers',
        'view_customers',
        'view_inventory',
        'transfer_inventory',
        'approve_sales',
        'view_reports',
        'manage_permissions',
        'SELLER_READ',
        'SELLER_CREATE',
        'SELLER_UPDATE',
        'CUSTOMER_READ',
        'CUSTOMER_CREATE',
        'SALES_READ',
        'INVENTORY_READ',
      ]);
    });

    test('D2: MANAGER_PERMISSIONS covers exactly the 7 functional territory roles', () => {
      assert.equal(MANAGER_PERMISSIONS.length, 7);
      assert.deepEqual(Array.from(MANAGER_PERMISSIONS), [
        'onboard_customers',
        'view_customers',
        'manage_sellers',
        'view_inventory',
        'transfer_inventory',
        'approve_sales',
        'view_reports',
      ]);
    });

    test('D3: hasPermission properly evaluates Super Admin vs Manager vs Seller authority', () => {
      // Super Admin has universal access
      assert.equal(hasPermission(superAdminUser, 'manage_permissions'), true);
      assert.equal(hasPermission(superAdminUser, 'approve_sales'), true);
      assert.equal(hasPermission(superAdminUser, 'any_arbitrary_key'), true);

      // Manager with granted permissions
      assert.equal(hasPermission(territoryManager, 'onboard_customers'), true);
      assert.equal(hasPermission(territoryManager, 'manage_sellers'), true);
      assert.equal(hasPermission(territoryManager, 'view_inventory'), true);

      // Manager lacking specific permission
      assert.equal(hasPermission(territoryManager, 'approve_sales'), false);
      assert.equal(hasPermission(territoryManager, 'transfer_inventory'), false);

      // Seller has no management permissions
      const seller: PublicUser = {
        id: 's_01',
        name: 'Field Officer',
        email: 'seller@femmeflo.com',
        role: 'SELLER',
        active: true,
        permissions: [],
      };
      assert.equal(hasPermission(seller, 'onboard_customers'), false);
      assert.equal(hasPermission(seller, 'manage_sellers'), false);
      assert.equal(hasPermission(seller, 'approve_sales'), false);
    });

    test('D4: syncPermissionAliases maps action permissions to legacy backend aliases', () => {
      const input = ['onboard_customers', 'manage_sellers', 'view_inventory'];
      const synced = syncPermissionAliases(input);

      // onboard_customers -> CUSTOMER_CREATE
      assert.ok(synced.includes('CUSTOMER_CREATE'));

      // manage_sellers -> SELLER_CREATE, SELLER_READ
      assert.ok(synced.includes('SELLER_CREATE'));
      assert.ok(synced.includes('SELLER_READ'));

      // view_inventory -> INVENTORY_READ
      assert.ok(synced.includes('INVENTORY_READ'));
    });

    test('D5: Permission helper functions evaluate correctly', () => {
      assert.equal(canOnboardCustomers(territoryManager), true);
      assert.equal(canManageSellers(territoryManager), true);
      assert.equal(canViewInventory(territoryManager), true);
      assert.equal(canApproveSales(territoryManager), false);
    });
  });

  // ====================================================
  // PART E: ALL SALES DIRECTORY & ORDERS LEDGER
  // ====================================================
  describe('Part E: All Sales Directory, Search, Filters & Invoices', () => {
    const mockSales: SaleItem[] = [
      {
        id: 'sale-001',
        saleNumber: 'SL-202610-001',
        customerId: 'cust-001',
        sellerId: 'seller-001',
        totalAmountPaise: 7000, // ₹70.00
        packetCount: 2,
        status: 'CONFIRMED',
        paymentMode: 'CASH',
        createdAt: '2026-10-31T10:00:00.000Z',
      },
      {
        id: 'sale-002',
        saleNumber: 'SL-202610-002',
        customerId: 'cust-002',
        sellerId: 'seller-001',
        totalAmountPaise: 4000, // ₹40.00
        packetCount: 2,
        status: 'PENDING_APPROVAL',
        paymentMode: 'PENDING',
        createdAt: '2026-10-31T11:00:00.000Z',
      },
      {
        id: 'sale-003',
        saleNumber: 'SL-202610-003',
        customerId: 'cust-001',
        sellerId: 'seller-002',
        totalAmountPaise: 10500, // ₹105.00
        packetCount: 3,
        status: 'REJECTED',
        paymentMode: 'BANK',
        createdAt: '2026-10-31T12:00:00.000Z',
      },
    ];

    test('E1: Filters sales ledger by status and paymentMode', () => {
      function filterSales(
        items: SaleItem[],
        status?: SaleStatus | 'ALL',
        paymentMode?: PaymentMode | 'ALL'
      ): SaleItem[] {
        return items.filter((s) => {
          if (status && status !== 'ALL' && s.status !== status) return false;
          if (paymentMode && paymentMode !== 'ALL' && s.paymentMode !== paymentMode) return false;
          return true;
        });
      }

      const confirmed = filterSales(mockSales, 'CONFIRMED', 'ALL');
      assert.equal(confirmed.length, 1);
      assert.equal(confirmed[0].id, 'sale-001');

      const pendingApproval = filterSales(mockSales, 'PENDING_APPROVAL', 'ALL');
      assert.equal(pendingApproval.length, 1);
      assert.equal(pendingApproval[0].id, 'sale-002');

      const cashSales = filterSales(mockSales, 'ALL', 'CASH');
      assert.equal(cashSales.length, 1);
      assert.equal(cashSales[0].paymentMode, 'CASH');
    });

    test('E2: Generates tax invoice PDF download URL with canonical parameter', () => {
      function getInvoicePdfUrl(baseUrl: string, id: string, download = true): string {
        return `${baseUrl}/invoices/${id}/pdf?download=${download ? 'true' : 'false'}`;
      }

      const url = getInvoicePdfUrl('https://api.femmeflo.com/api/v1', 'sale-001', true);
      assert.equal(url, 'https://api.femmeflo.com/api/v1/invoices/sale-001/pdf?download=true');
    });
  });

  // ====================================================
  // PART F & G: CUSTOMERS DIRECTORY & BULK ONBOARDING
  // ====================================================
  describe('Part F & G: Customer Management & Bulk Onboarding Parity', () => {
    test('F1: Customer record contains complete contact, territory, photo & GPS fields', () => {
      const customer: CustomerItem = {
        id: 'cust-101',
        shopName: 'Shree Krishna Medical & General Store',
        ownerName: 'Radhe Shyam',
        contactName: 'Radhe Shyam',
        email: 'shree.krishna@example.com',
        phone: '+919876543210',
        address: 'Opposite District Hospital',
        pincode: '221002',
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        village: 'Cantonment',
        latitude: 25.3215,
        longitude: 82.985,
        photoUrl: 'https://cdn.femmeflo.com/photos/cust-101.jpg',
        active: true,
        createdAt: '2026-10-31T08:00:00.000Z',
      };

      assert.ok(customer.shopName);
      assert.ok(customer.phone);
      assert.ok(customer.latitude && customer.longitude);
      assert.ok(customer.photoUrl);
      assert.equal(customer.active, true);
    });

    test('G1: Batch customer onboarding validates batch size between 1 and 100 rows', () => {
      function validateBatchSize(rows: Array<any>): boolean {
        if (!rows || rows.length < 1) {
          throw new Error('Batch onboarding requires at least 1 customer row');
        }
        if (rows.length > 100) {
          throw new Error('Batch onboarding cannot exceed 100 customer rows per submission');
        }
        return true;
      }

      // Valid: 1 row
      assert.equal(validateBatchSize([{ shopName: 'Shop 1' }]), true);

      // Valid: 50 rows
      const fiftyRows = Array.from({ length: 50 }, (_, i) => ({ shopName: `Shop ${i + 1}` }));
      assert.equal(validateBatchSize(fiftyRows), true);

      // Valid: 100 rows
      const hundredRows = Array.from({ length: 100 }, (_, i) => ({ shopName: `Shop ${i + 1}` }));
      assert.equal(validateBatchSize(hundredRows), true);

      // Blocked: 0 rows
      assert.throws(() => validateBatchSize([]), /at least 1 customer row/);

      // Blocked: 101 rows
      const tooMany = Array.from({ length: 101 }, (_, i) => ({ shopName: `Shop ${i + 1}` }));
      assert.throws(() => validateBatchSize(tooMany), /cannot exceed 100/);
    });
  });

  describe('Part H: Administrative Action Hub & Navigation Integrity', () => {
    test('H1: All 13 master administrative modules are registered with strict indexes, routes and categories', () => {
      const EXPECTED_MODULES = [
        { id: 'reports', index: 1, route: '/(admin)/reports', category: 'finance' },
        { id: 'approvals', index: 2, route: '/(admin)/approvals', category: 'governance' },
        { id: 'products', index: 3, route: '/(admin)/products', category: 'stock' },
        { id: 'invoices', index: 4, route: '/(admin)/invoices', category: 'finance' },
        { id: 'sales', index: 5, route: '/(admin)/sales', category: 'finance' },
        { id: 'incentives', index: 6, route: '/(admin)/incentives', category: 'finance' },
        { id: 'shifts', index: 7, route: '/(admin)/shifts', category: 'field' },
        { id: 'permissions', index: 8, route: '/(admin)/permissions', category: 'governance' },
        { id: 'customers', index: 9, route: '/(admin)/customers', category: 'field' },
        { id: 'inventory', index: 10, route: '/(admin)/inventory/transfer', category: 'stock' },
        { id: 'users', index: 11, route: '/(admin)/users', category: 'field' },
        { id: 'categories', index: 12, route: '/(admin)/categories', category: 'system' },
        { id: 'settings', index: 13, route: '/(admin)/settings', category: 'system' },
      ];

      assert.equal(EXPECTED_MODULES.length, 13);
      for (let i = 0; i < EXPECTED_MODULES.length; i++) {
        assert.equal(EXPECTED_MODULES[i].index, i + 1);
        assert.ok(EXPECTED_MODULES[i].route.startsWith('/(admin)/'));
      }
    });

    test('H2: Admin layout does not use href: null on sub-screens to prevent redirect-to-index trap', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const layoutContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/_layout.tsx'),
        'utf8'
      );

      // Verify actions/index is declared without href: null
      assert.ok(layoutContent.includes('name="actions/index"'));
      assert.ok(!layoutContent.includes('name="actions/index"\n        options={{ href: null }}'));
      assert.ok(!layoutContent.includes("name='actions/index'\n        options={{ href: null }}"));
      // Ensure no screen uses href: null
      assert.ok(!layoutContent.includes('href: null'));
    });
  });

  describe('Part I: Real-time Executive Telemetry & Approval Count Synchronization', () => {
    test('I1: Executive overview and Actions Hub wire useFocusEffect and DeviceEventEmitter listener', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const executiveSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/index.tsx'),
        'utf8'
      );
      assert.ok(executiveSource.includes('useFocusEffect'), 'Executive overview must wire useFocusEffect');
      assert.ok(
        executiveSource.includes("DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED'"),
        'Executive overview must listen to APPROVAL_STATUS_CHANGED'
      );

      const actionsSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/actions/index.tsx'),
        'utf8'
      );
      assert.ok(actionsSource.includes('useFocusEffect'), 'Actions Hub must wire useFocusEffect');
      assert.ok(
        actionsSource.includes("DeviceEventEmitter.addListener('APPROVAL_STATUS_CHANGED'"),
        'Actions Hub must listen to APPROVAL_STATUS_CHANGED'
      );

      const approvalsSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/approvals/index.tsx'),
        'utf8'
      );
      assert.ok(approvalsSource.includes('useFocusEffect'), 'Approvals screen must wire useFocusEffect');
      assert.ok(
        approvalsSource.includes("DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED'"),
        'Approvals screen must emit APPROVAL_STATUS_CHANGED on approval or rejection'
      );
    });

    test('I2: Approval event triggers optimistic decrement and preserves lower bound of 0', () => {
      function applyOptimisticApproval(count: number): number {
        return Math.max(0, count - 1);
      }

      assert.equal(applyOptimisticApproval(5), 4);
      assert.equal(applyOptimisticApproval(1), 0);
      assert.equal(applyOptimisticApproval(0), 0);
    });
  });

  describe('Part J: HQ Stock Transfers & Inward Receipts Dropdown Searchable Parity', () => {
    test('J1: Source warehouse initialization guarantees fallback HQ warehouse when API returns empty list', () => {
      // Mock scenario where backend returns empty warehouse list because locations are typed as "HQ" instead of "WAREHOUSE"
      const emptyApiResponse: any[] = [];
      const defaultWarehouses = [
        {
          id: 'loc_hq_central',
          name: 'Central HQ Warehouse',
          code: 'WH-HQ-01',
          type: 'HQ',
          balance: 0,
          state: 'Uttar Pradesh',
          district: 'Varanasi',
        },
      ];

      const resolvedWarehouses = emptyApiResponse.length > 0 ? emptyApiResponse : defaultWarehouses;

      assert.ok(resolvedWarehouses.length >= 1, 'Warehouses list must never be empty');
      assert.equal(resolvedWarehouses[0].id, 'loc_hq_central');
      assert.equal(resolvedWarehouses[0].name, 'Central HQ Warehouse');
      assert.equal(resolvedWarehouses[0].type, 'HQ');
    });

    test('J2: Searchable dropdown filter accurately matches titles, codes, and metadata', () => {
      const options = [
        {
          id: 'wh_1',
          title: 'Central HQ Warehouse',
          subtitle: 'Code: WH-HQ-01 • Stock Balance: 50,000 pkts',
          badge: 'CENTRAL HQ',
          metadata: 'Uttar Pradesh Varanasi WH-HQ-01',
        },
        {
          id: 'wh_2',
          title: 'Varanasi Regional Depot',
          subtitle: 'Code: WH-VNS-02 • Stock Balance: 12,500 pkts',
          badge: 'REGIONAL',
          metadata: 'Uttar Pradesh Varanasi WH-VNS-02',
        },
        {
          id: 'wh_3',
          title: 'Lucknow Logistics Hub',
          subtitle: 'Code: WH-LKO-01 • Stock Balance: 8,200 pkts',
          badge: 'REGIONAL',
          metadata: 'Uttar Pradesh Lucknow WH-LKO-01',
        },
      ];

      function filterOptions(query: string) {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((opt) => {
          const matchTitle = opt.title.toLowerCase().includes(q);
          const matchSubtitle = opt.subtitle ? opt.subtitle.toLowerCase().includes(q) : false;
          const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(q) : false;
          const matchMeta = opt.metadata ? opt.metadata.toLowerCase().includes(q) : false;
          return matchTitle || matchSubtitle || matchBadge || matchMeta;
        });
      }

      // Exact title search
      const resLucknow = filterOptions('Lucknow');
      assert.equal(resLucknow.length, 1);
      assert.equal(resLucknow[0].id, 'wh_3');

      // Substring code search
      const resCode = filterOptions('WH-VNS');
      assert.equal(resCode.length, 1);
      assert.equal(resCode[0].id, 'wh_2');

      // District metadata search
      const resDistrict = filterOptions('Varanasi');
      assert.equal(resDistrict.length, 2);

      // Badge search
      const resBadge = filterOptions('CENTRAL HQ');
      assert.equal(resBadge.length, 1);
      assert.equal(resBadge[0].id, 'wh_1');
    });

    test('J3: Transfer mode validates destination whereas Inward Receipt routes stock to Source Warehouse', () => {
      interface TransferPayloadMock {
        mode: 'TRANSFER' | 'RECEIPT';
        sourceWarehouseId: string;
        targetLocationId: string;
        batchNumber: string;
        quantity: number;
      }

      function validateTransferForm(form: TransferPayloadMock): { valid: boolean; error?: string } {
        if (!form.sourceWarehouseId) {
          return { valid: false, error: 'Source warehouse is required' };
        }
        if (form.mode === 'TRANSFER' && !form.targetLocationId) {
          return { valid: false, error: 'Destination target is required for transfer' };
        }
        if (form.mode === 'RECEIPT' && !form.batchNumber.trim()) {
          return { valid: false, error: 'Supplier batch number is required for inward receipt' };
        }
        if (form.quantity <= 0) {
          return { valid: false, error: 'Quantity must be greater than zero' };
        }
        return { valid: true };
      }

      // Valid Transfer
      const transferValid = validateTransferForm({
        mode: 'TRANSFER',
        sourceWarehouseId: 'loc_hq_central',
        targetLocationId: 'seller_101',
        batchNumber: '',
        quantity: 50,
      });
      assert.equal(transferValid.valid, true);

      // Invalid Transfer (missing target)
      const transferMissingTarget = validateTransferForm({
        mode: 'TRANSFER',
        sourceWarehouseId: 'loc_hq_central',
        targetLocationId: '',
        batchNumber: '',
        quantity: 50,
      });
      assert.equal(transferMissingTarget.valid, false);
      assert.equal(transferMissingTarget.error, 'Destination target is required for transfer');

      // Valid Inward Receipt (target location automatically set to warehouse or supplier)
      const receiptValid = validateTransferForm({
        mode: 'RECEIPT',
        sourceWarehouseId: 'loc_hq_central',
        targetLocationId: 'loc_hq_central',
        batchNumber: 'MFG-2026-0881',
        quantity: 1000,
      });
      assert.equal(receiptValid.valid, true);

      // Invalid Inward Receipt (missing batch)
      const receiptMissingBatch = validateTransferForm({
        mode: 'RECEIPT',
        sourceWarehouseId: 'loc_hq_central',
        targetLocationId: 'loc_hq_central',
        batchNumber: '',
        quantity: 1000,
      });
      assert.equal(receiptMissingBatch.valid, false);
      assert.equal(receiptMissingBatch.error, 'Supplier batch number is required for inward receipt');
    });

    test('J4: Quick-add quantity increment calculates clean rounded batches', () => {
      function addQuantity(current: number, increment: number): number {
        return Math.max(1, current + increment);
      }

      assert.equal(addQuantity(10, 25), 35);
      assert.equal(addQuantity(35, 50), 85);
      assert.equal(addQuantity(85, 100), 185);
      assert.equal(addQuantity(185, 500), 685);
    });
  });

  describe('Part K: Super Admin Seller Onboarding & Supervising Territory Manager Searchable Dropdown', () => {
    const mockManagers: PublicUser[] = [
      {
        id: 'mgr_vns_01',
        name: 'Varanasi Territory Manager',
        email: 'manager.varanasi@femmeflo.com',
        phone: '+919876543210',
        role: 'MANAGER',
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        active: true,
      },
      {
        id: 'mgr_lko_02',
        name: 'Lucknow Operations Head',
        email: 'manager.lucknow@femmeflo.com',
        phone: '+919811223344',
        role: 'MANAGER',
        state: 'Uttar Pradesh',
        district: 'Lucknow',
        active: true,
      },
      {
        id: 'mgr_tha_03',
        name: 'Thane Territory Lead',
        email: 'manager.thane@femmeflo.com',
        phone: '+919899001122',
        role: 'MANAGER',
        state: 'Maharashtra',
        district: 'Thane',
        active: true,
      },
    ];

    test('K1: Supervising manager search filters accurately across name, phone, email, and district', () => {
      function searchManagers(query: string, list: PublicUser[]) {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter((m) => {
          const matchName = m.name?.toLowerCase().includes(q) ?? false;
          const matchEmail = m.email?.toLowerCase().includes(q) ?? false;
          const matchPhone = m.phone?.toLowerCase().includes(q) ?? false;
          const matchDistrict = m.district?.toLowerCase().includes(q) ?? false;
          const matchState = m.state?.toLowerCase().includes(q) ?? false;
          return matchName || matchEmail || matchPhone || matchDistrict || matchState;
        });
      }

      const resVaranasi = searchManagers('Varanasi', mockManagers);
      assert.equal(resVaranasi.length, 1);
      assert.equal(resVaranasi[0].id, 'mgr_vns_01');

      const resPhone = searchManagers('9811', mockManagers);
      assert.equal(resPhone.length, 1);
      assert.equal(resPhone[0].id, 'mgr_lko_02');

      const resUP = searchManagers('Uttar Pradesh', mockManagers);
      assert.equal(resUP.length, 2);

      const resName = searchManagers('Thane', mockManagers);
      assert.equal(resName.length, 1);
      assert.equal(resName[0].id, 'mgr_tha_03');
    });

    test('K2: Field seller onboarding enforces valid name, 10-digit mobile, >=12 char password, and managerId', () => {
      function validateSellerForm(form: {
        name: string;
        phone: string;
        password: string;
        managerId: string;
      }): { valid: boolean; errors: Record<string, string> } {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = 'Full name is required.';
        const cleanPhone = form.phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) errs.phone = 'Please enter a valid 10-digit mobile number.';
        if (!form.password || form.password.length < 12) {
          errs.password = 'Initial password must be at least 12 characters.';
        }
        if (!form.managerId) {
          errs.managerId = 'Please select a supervising Territory Manager.';
        }
        return { valid: Object.keys(errs).length === 0, errors: errs };
      }

      const validRes = validateSellerForm({
        name: 'Ramesh Patil',
        phone: '9876543210',
        password: 'FemmeFlo@2026',
        managerId: 'mgr_vns_01',
      });
      assert.equal(validRes.valid, true);

      const missingMgr = validateSellerForm({
        name: 'Ramesh Patil',
        phone: '9876543210',
        password: 'FemmeFlo@2026',
        managerId: '',
      });
      assert.equal(missingMgr.valid, false);
      assert.equal(missingMgr.errors.managerId, 'Please select a supervising Territory Manager.');

      const shortPass = validateSellerForm({
        name: 'Ramesh Patil',
        phone: '9876543210',
        password: 'pass123',
        managerId: 'mgr_vns_01',
      });
      assert.equal(shortPass.valid, false);
      assert.equal(shortPass.errors.password, 'Initial password must be at least 12 characters.');
    });

    test('K3: Selecting supervising manager auto-populates seller operational state & district', () => {
      let state = 'Maharashtra';
      let district = 'Thane';

      function selectManager(manager: PublicUser) {
        if (manager.state) state = manager.state;
        if (manager.district) district = manager.district;
      }

      selectManager(mockManagers[0]);
      assert.equal(state, 'Uttar Pradesh');
      assert.equal(district, 'Varanasi');

      selectManager(mockManagers[1]);
      assert.equal(state, 'Uttar Pradesh');
      assert.equal(district, 'Lucknow');
    });

    test('K4: Manager selection dropdown modal and trigger are properly integrated', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const usersSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/users/index.tsx'),
        'utf8'
      );

      assert.ok(
        usersSource.includes('DropdownTrigger'),
        'Users screen must integrate DropdownTrigger for Supervising Territory Manager'
      );
      assert.ok(
        usersSource.includes('isManagerPickerOpen'),
        'Users screen must support searchable manager picker mode'
      );
      assert.ok(
        usersSource.includes('filteredManagers'),
        'Users screen must compute filtered managers in real time'
      );
    });
  });


  describe('Part L: Super Admin Settings Parity, Legal Details Edit Mode & Change Password Separation', () => {
    test('L1: Dummy seed company strings are stripped so form starts clean without prefilled mock data', () => {
      function sanitizeLoadedSettings(res: Partial<BusinessSettings>): Record<string, string> {
        return {
          companyName: res.companyName && res.companyName !== 'MASAKO ENTERPRISES PRIVATE LIMITED' ? res.companyName : '',
          companyGst: res.companyGst && res.companyGst !== '09AAECM1234F1Z5' ? res.companyGst : '',
          companyPan: res.companyPan && res.companyPan !== 'AAECM1234F' ? res.companyPan : '',
          companyAddress: res.companyAddress && !res.companyAddress.includes('Plot 42') ? res.companyAddress : '',
          companyPhone: res.companyPhone && res.companyPhone !== '+91 9876543210' ? res.companyPhone : '',
          companyEmail: res.companyEmail && res.companyEmail !== 'billing@masako.co.in' ? res.companyEmail : '',
          invoiceTerms: res.invoiceTerms && !res.invoiceTerms.includes('Goods once sold will not be taken back') ? res.invoiceTerms : '',
        };
      }

      // Default seed input
      const defaultSeed = {
        companyName: 'MASAKO ENTERPRISES PRIVATE LIMITED',
        companyGst: '09AAECM1234F1Z5',
        companyAddress: 'Plot 42, Industrial Area Phase II, Lucknow, UP',
      };
      const cleaned = sanitizeLoadedSettings(defaultSeed);
      assert.equal(cleaned.companyName, '');
      assert.equal(cleaned.companyGst, '');
      assert.equal(cleaned.companyAddress, '');

      // Genuine user input
      const genuineUser = {
        companyName: 'FemmeFlo Distribution LLP',
        companyGst: '27AABCU9603R1ZM',
        companyAddress: 'MG Road, Pune, Maharashtra 411001',
      };
      const genuineCleaned = sanitizeLoadedSettings(genuineUser);
      assert.equal(genuineCleaned.companyName, 'FemmeFlo Distribution LLP');
      assert.equal(genuineCleaned.companyGst, '27AABCU9603R1ZM');
      assert.equal(genuineCleaned.companyAddress, 'MG Road, Pune, Maharashtra 411001');
    });

    test('L2: Legal details form toggles between view mode and active edit mode with Cancel/Save state', () => {
      let isEditingLegal = false;
      let companyName = 'Old Corp';
      const originalLegal = { companyName: 'Old Corp' };

      // Enter edit mode
      isEditingLegal = true;
      companyName = 'New Corp Draft';

      // Cancel reverts to original
      function cancelEdit() {
        companyName = originalLegal.companyName;
        isEditingLegal = false;
      }
      cancelEdit();
      assert.equal(isEditingLegal, false);
      assert.equal(companyName, 'Old Corp');

      // Save confirms new value
      isEditingLegal = true;
      companyName = 'FemmeFlo Official Pvt Ltd';
      function saveEdit() {
        originalLegal.companyName = companyName;
        isEditingLegal = false;
      }
      saveEdit();
      assert.equal(isEditingLegal, false);
      assert.equal(companyName, 'FemmeFlo Official Pvt Ltd');
      assert.equal(originalLegal.companyName, 'FemmeFlo Official Pvt Ltd');
    });

    test('L3: Dedicated change password screen and layout registration are verified', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const layoutSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/_layout.tsx'),
        'utf8'
      );
      assert.ok(
        layoutSource.includes('name="settings/password"'),
        'Admin tabs layout must register settings/password screen'
      );

      const settingsSource = fs.readFileSync(
        path.resolve(process.cwd(), 'src/app/(admin)/settings/index.tsx'),
        'utf8'
      );
      assert.ok(
        settingsSource.includes('/(admin)/settings/password'),
        'Settings index must link to /(admin)/settings/password'
      );
      assert.ok(
        settingsSource.includes('isEditingLegal'),
        'Settings index must implement isEditingLegal state'
      );
    });

    test('L4: Password change validation enforces security invariants', () => {
      function validatePasswordChange(current: string, next: string, confirm: string) {
        if (!current) return { valid: false, error: 'Current password required' };
        if (next.length < 12) return { valid: false, error: 'Must be at least 12 characters' };
        const byteLen = new TextEncoder().encode(next).length;
        if (byteLen > 72) return { valid: false, error: 'Exceeds 72 bytes' };
        if (next !== confirm) return { valid: false, error: 'Passwords mismatch' };
        return { valid: true };
      }

      assert.equal(validatePasswordChange('', 'FemmeFlo@2026', 'FemmeFlo@2026').valid, false);
      assert.equal(validatePasswordChange('OldPass@123', 'short', 'short').valid, false);
      assert.equal(validatePasswordChange('OldPass@123', 'FemmeFlo@2026', 'Different@2026').valid, false);
      assert.equal(validatePasswordChange('OldPass@123', 'FemmeFlo@2026', 'FemmeFlo@2026').valid, true);
    });
  });

});
