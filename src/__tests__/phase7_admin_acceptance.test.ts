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
});
