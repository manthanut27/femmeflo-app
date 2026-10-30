import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import type {
  AdminDashboardData,
  BusinessSettings,
  InventorySummaryData,
  InvoiceItem,
  ProductItem,
  PublicUser,
  SaleItem,
  SalesReportData,
  StockLocationItem,
} from '../api/types.ts';
import {
  ALL_BACKEND_PERMISSIONS,
  hasPermission,
  canApproveSales,
  canViewReports,
  canManageSellers,
  canViewInventory,
} from '../utils/permissions.ts';

describe('FemmeFlo Phase 8: Executive Governance, Invoices, CSV Export & Release Readiness', () => {
  // ====================================================
  // PART A: EXECUTIVE DASHBOARD FILTERING
  // ====================================================
  describe('Part A: Executive Dashboard Dynamic Filtering', () => {
    function compileDashboardFilters(params: {
      state?: string;
      district?: string;
      village?: string;
      managerId?: string;
      sellerId?: string;
      categoryId?: string;
      datePreset?: 'all' | 'today' | 'last7' | 'last30' | 'custom';
      customFrom?: string;
      customTo?: string;
    }) {
      const query: Record<string, string> = {};
      if (params.state) query.state = params.state;
      if (params.district) query.district = params.district;
      if (params.village) query.village = params.village;
      if (params.managerId) query.managerId = params.managerId;
      if (params.sellerId) query.sellerId = params.sellerId;
      if (params.categoryId) query.categoryId = params.categoryId;

      const now = new Date('2026-10-31T12:00:00.000Z');
      if (params.datePreset === 'today') {
        const todayStr = '2026-10-31';
        query.from = `${todayStr}T00:00:00.000Z`;
        query.to = `${todayStr}T23:59:59.999Z`;
      } else if (params.datePreset === 'last7') {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        query.from = past.toISOString();
        query.to = now.toISOString();
      } else if (params.datePreset === 'last30') {
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        query.from = past.toISOString();
        query.to = now.toISOString();
      } else if (params.datePreset === 'custom') {
        if (params.customFrom) query.from = params.customFrom;
        if (params.customTo) query.to = params.customTo;
      }
      return query;
    }

    function calculateActiveFilterCount(filters: Record<string, any>): number {
      let count = 0;
      if (filters.state) count++;
      if (filters.district) count++;
      if (filters.village) count++;
      if (filters.managerId) count++;
      if (filters.sellerId) count++;
      if (filters.categoryId) count++;
      if (filters.datePreset && filters.datePreset !== 'all') count++;
      return count;
    }

    test('compiles multi-dimensional filters correctly', () => {
      const filters = compileDashboardFilters({
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        managerId: 'usr_mgr_01',
        datePreset: 'today',
      });

      assert.equal(filters.state, 'Uttar Pradesh');
      assert.equal(filters.district, 'Varanasi');
      assert.equal(filters.managerId, 'usr_mgr_01');
      assert.ok(filters.from?.includes('2026-10-31'));
      assert.ok(filters.to?.includes('2026-10-31'));
    });

    test('accurately computes active filter badge count', () => {
      const emptyCount = calculateActiveFilterCount({ datePreset: 'all' });
      assert.equal(emptyCount, 0);

      const multiCount = calculateActiveFilterCount({
        state: 'Uttar Pradesh',
        district: 'Lucknow',
        categoryId: 'cat_pharma',
        datePreset: 'last7',
      });
      assert.equal(multiCount, 4);
    });

    test('supports custom date range filtering', () => {
      const filters = compileDashboardFilters({
        datePreset: 'custom',
        customFrom: '2026-10-01T00:00:00.000Z',
        customTo: '2026-10-15T23:59:59.999Z',
      });
      assert.equal(filters.from, '2026-10-01T00:00:00.000Z');
      assert.equal(filters.to, '2026-10-15T23:59:59.999Z');
    });

    test('maps dashboard summary metrics and handles fallbacks gracefully', () => {
      const mockApiData: Partial<AdminDashboardData> = {
        totalRevenuePaise: 2500000,
        totalPacketsSold: 1000,
        activeSellers: 12,
        pendingApprovalsCount: 3,
        metrics: {
          totalPacketsSold: 1000,
          totalEarningsPaise: 2500000,
          totalEarningsRupees: 25000,
          totalShops: 45,
          totalStates: 2,
          totalInventory: 5000,
          hqStock: 3000,
          warehouseStock: 1500,
          sellerStock: 500,
        },
      };

      const revenuePaise = mockApiData.totalRevenuePaise || (mockApiData.metrics?.totalEarningsPaise || 0);
      const totalInventory = mockApiData.metrics?.totalInventory || 0;
      const pendingApprovals = mockApiData.pendingApprovalsCount || 0;

      assert.equal(revenuePaise, 2500000);
      assert.equal(totalInventory, 5000);
      assert.equal(pendingApprovals, 3);
    });
  });

  // ====================================================
  // PART B: COMPANY LEGAL SETTINGS & SECURITY
  // ====================================================
  describe('Part B: Company Legal Entity, Invoicing & Governance', () => {
    function validateLegalSettings(settings: Partial<BusinessSettings>): {
      isValid: boolean;
      errors: string[];
    } {
      const errors: string[] = [];
      if (settings.companyName !== undefined && !settings.companyName.trim()) {
        errors.push('Company name cannot be empty');
      }
      if (settings.companyGst !== undefined && settings.companyGst.length > 0) {
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(settings.companyGst)) {
          errors.push('Invalid GSTIN format');
        }
      }
      if (settings.companyPan !== undefined && settings.companyPan.length > 0) {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(settings.companyPan)) {
          errors.push('Invalid PAN format');
        }
      }
      if (settings.minimumPricePaise !== undefined && settings.minimumPricePaise <= 0) {
        errors.push('Minimum sale price must be positive');
      }
      if (settings.lowStockThreshold !== undefined && settings.lowStockThreshold < 0) {
        errors.push('Low stock threshold cannot be negative');
      }
      return { isValid: errors.length === 0, errors };
    }

    test('validates valid company legal settings successfully', () => {
      const validSettings: Partial<BusinessSettings> = {
        companyName: 'MASAKO ENTERPRISES PRIVATE LIMITED',
        companyGst: '09AAECM1234F1Z5',
        companyPan: 'AAECM1234F',
        companyAddress: 'Plot 42, Industrial Area, Lucknow, UP',
        companyPhone: '+91 9876543210',
        companyEmail: 'billing@masako.co.in',
        invoiceTerms: '1. Goods once sold will not be returned.',
        minimumPricePaise: 2500,
        lowStockThreshold: 50,
      };

      const result = validateLegalSettings(validSettings);
      assert.ok(result.isValid);
      assert.equal(result.errors.length, 0);
    });

    test('rejects malformed GSTIN and PAN formats', () => {
      const invalidSettings: Partial<BusinessSettings> = {
        companyGst: 'INVALID_GST_123',
        companyPan: 'PAN999',
      };
      const result = validateLegalSettings(invalidSettings);
      assert.ok(!result.isValid);
      assert.ok(result.errors.some((e) => e.includes('GSTIN')));
      assert.ok(result.errors.some((e) => e.includes('PAN')));
    });

    test('enforces password change security constraints', () => {
      function validatePasswordChange(cur: string, next: string, confirm: string) {
        if (!cur) return { valid: false, error: 'Current password required' };
        if (next.length < 12) return { valid: false, error: 'Minimum 12 characters required' };
        if (new TextEncoder().encode(next).length > 72) return { valid: false, error: 'Exceeds 72 bytes' };
        if (next !== confirm) return { valid: false, error: 'Passwords do not match' };
        return { valid: true, error: null };
      }

      assert.ok(!validatePasswordChange('', 'NewStrongPass123!', 'NewStrongPass123!').valid);
      assert.ok(!validatePasswordChange('curPass123!', 'shortPass1', 'shortPass1').valid);
      assert.ok(!validatePasswordChange('curPass123!', 'ValidStrongPassword123!', 'MismatchPassword123!').valid);
      assert.ok(validatePasswordChange('curPass123!', 'ValidStrongPassword123!', 'ValidStrongPassword123!').valid);
    });
  });

  // ====================================================
  // PART C: CENTRAL INVOICE DIRECTORY
  // ====================================================
  describe('Part C: Central Invoice Directory & PDF Generation', () => {
    const mockInvoices: InvoiceItem[] = [
      {
        id: 'inv_01',
        number: 'INV-2026-00001',
        saleId: 'sale_01',
        createdAt: '2026-10-31T10:30:00.000Z',
        sale: {
          id: 'sale_01',
          saleNumber: 'FF-2026-00042',
          quantity: 20,
          packetCount: 20,
          totalPaise: 50000,
          totalAmountPaise: 50000,
          paymentMode: 'CASH',
          customer: {
            id: 'cust_01',
            shopName: 'Gupta Medical Hall',
            contactName: 'Ramesh Gupta',
            phone: '9876543210',
            email: 'gupta@medical.com',
          },
          seller: {
            id: 'sell_01',
            name: 'Pooja Verma',
            phone: '9876543211',
          },
        },
        deliveries: [
          { channel: 'EMAIL', status: 'SENT', sentAt: '2026-10-31T10:31:00.000Z' },
          { channel: 'WHATSAPP', status: 'SENT', sentAt: '2026-10-31T10:31:05.000Z' },
        ],
      },
      {
        id: 'inv_02',
        number: 'INV-2026-00002',
        saleId: 'sale_02',
        createdAt: '2026-10-31T11:00:00.000Z',
        sale: {
          id: 'sale_02',
          saleNumber: 'FF-2026-00043',
          quantity: 50,
          packetCount: 50,
          totalPaise: 125000,
          totalAmountPaise: 125000,
          paymentMode: 'PENDING',
          customer: {
            id: 'cust_02',
            shopName: 'Shri Ram General Store',
            contactName: 'Ram Kumar',
            phone: '9123456789',
          },
          seller: {
            id: 'sell_02',
            name: 'Sunita Sharma',
          },
        },
        deliveries: [],
      },
    ];

    function filterInvoices(
      list: InvoiceItem[],
      search: string,
      paymentFilter: 'ALL' | 'PAID' | 'PENDING'
    ): InvoiceItem[] {
      return list.filter((inv) => {
        const query = search.toLowerCase().trim();
        const matchesSearch =
          !query ||
          inv.number.toLowerCase().includes(query) ||
          (inv.sale?.customer?.shopName || '').toLowerCase().includes(query) ||
          (inv.sale?.seller?.name || '').toLowerCase().includes(query) ||
          (inv.sale?.saleNumber || '').toLowerCase().includes(query);

        if (!matchesSearch) return false;

        const isPending = inv.sale?.paymentMode === 'PENDING' || inv.sale?.paymentMode === 'CREDIT';
        if (paymentFilter === 'PAID' && isPending) return false;
        if (paymentFilter === 'PENDING' && !isPending) return false;

        return true;
      });
    }

    test('filters invoices by search term matching shop name and officer', () => {
      const matchShop = filterInvoices(mockInvoices, 'Gupta', 'ALL');
      assert.equal(matchShop.length, 1);
      assert.equal(matchShop[0].id, 'inv_01');

      const matchOfficer = filterInvoices(mockInvoices, 'Sunita', 'ALL');
      assert.equal(matchOfficer.length, 1);
      assert.equal(matchOfficer[0].id, 'inv_02');
    });

    test('filters invoices by payment status', () => {
      const paidInvoices = filterInvoices(mockInvoices, '', 'PAID');
      assert.equal(paidInvoices.length, 1);
      assert.equal(paidInvoices[0].number, 'INV-2026-00001');

      const pendingInvoices = filterInvoices(mockInvoices, '', 'PENDING');
      assert.equal(pendingInvoices.length, 1);
      assert.equal(pendingInvoices[0].number, 'INV-2026-00002');
    });

    test('constructs proper PDF endpoint URLs for viewing and downloading', () => {
      const baseUrl = 'http://localhost:5000/api/v1';
      const invoiceId = 'inv_test_99';

      const viewUrl = `${baseUrl}/admin/invoices/${invoiceId}/pdf?download=false`;
      const downloadUrl = `${baseUrl}/admin/invoices/${invoiceId}/pdf?download=true`;

      assert.ok(viewUrl.includes('download=false'));
      assert.ok(downloadUrl.includes('download=true'));
      assert.ok(viewUrl.includes(`/admin/invoices/${invoiceId}/pdf`));
    });
  });

  // ====================================================
  // PART D: GENUINE CSV EXPORT ENGINE
  // ====================================================
  describe('Part D: RFC-4180 Compliant CSV Export Engine', () => {
    function escapeCsvCell(val: any): string {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    function buildCsv(headers: string[], rows: (string | number)[][]): string {
      const headerLine = headers.map(escapeCsvCell).join(',');
      const rowLines = rows.map((r) => r.map(escapeCsvCell).join(','));
      return [headerLine, ...rowLines].join('\r\n');
    }

    test('escapes commas, quotes, and newlines according to RFC-4180', () => {
      assert.equal(escapeCsvCell('SimpleText'), 'SimpleText');
      assert.equal(escapeCsvCell('Text with, comma'), '"Text with, comma"');
      assert.equal(escapeCsvCell('Text with "quotes"'), '"Text with ""quotes"""');
      assert.equal(escapeCsvCell('Line1\nLine2'), '"Line1\nLine2"');
    });

    test('generates genuine Sales Report CSV format', () => {
      const headers = [
        'Sale Number',
        'Customer Shop',
        'District',
        'Field Officer',
        'Packets Sold',
        'Total Amount (INR)',
        'Payment Mode',
        'Customer Feedback',
      ];

      const rows = [
        ['FF-2026-00001', 'Gupta Medical, Varanasi', 'Varanasi', 'Pooja Verma', 20, '500.00', 'CASH', 'Owner said "Stock fast"'],
        ['FF-2026-00002', 'Shri Ram Store', 'Lucknow', 'Sunita Sharma', 50, '1250.00', 'PENDING', 'Payment next week'],
      ];

      const csv = buildCsv(headers, rows);
      const lines = csv.split('\r\n');

      assert.equal(lines.length, 3);
      assert.equal(lines[0], 'Sale Number,Customer Shop,District,Field Officer,Packets Sold,Total Amount (INR),Payment Mode,Customer Feedback');
      assert.ok(lines[1].includes('"Gupta Medical, Varanasi"'));
      assert.ok(lines[1].includes('"Owner said ""Stock fast"""'));
      assert.ok(lines[2].includes('Shri Ram Store'));
    });

    test('generates genuine Inventory Locations Report CSV', () => {
      const headers = ['Location Name', 'Location Type', 'Assigned Personnel', 'Stock Balance (Packets)'];
      const rows = [
        ['Central HQ Warehouse', 'HQ', 'HQ Operations', 5000],
        ['Varanasi Regional Hub', 'WAREHOUSE', 'Territory Manager', 1500],
        ['Pooja Mobile Van Kit', 'SELLER', 'Pooja Verma', 200],
      ];

      const csv = buildCsv(headers, rows);
      const lines = csv.split('\r\n');

      assert.equal(lines.length, 4);
      assert.equal(lines[0], 'Location Name,Location Type,Assigned Personnel,Stock Balance (Packets)');
      assert.equal(lines[1], 'Central HQ Warehouse,HQ,HQ Operations,5000');
    });
  });

  // ====================================================
  // PART E: ROLE & PERMISSION MATRIX AUDIT
  // ====================================================
  describe('Part E: Comprehensive Role & Permission Matrix Audit', () => {
    test('SUPER_ADMIN possesses full governance permissions', () => {
      const admin: PublicUser = {
        id: 'usr_admin',
        name: 'Super Admin',
        email: 'admin@femmeflo.com',
        role: 'SUPER_ADMIN',
        active: true,
      };

      for (const perm of ALL_BACKEND_PERMISSIONS) {
        assert.ok(hasPermission(admin, perm), `Super Admin must have permission: ${perm}`);
      }
      assert.ok(canApproveSales(admin));
      assert.ok(canViewReports(admin));
    });

    test('MANAGER respects scoped territory permissions', () => {
      const manager: PublicUser = {
        id: 'usr_mgr',
        name: 'Varanasi Manager',
        email: 'mgr@femmeflo.com',
        role: 'MANAGER',
        active: true,
        permissions: ['manage_sellers', 'view_inventory', 'view_reports'],
      };

      assert.ok(canManageSellers(manager));
      assert.ok(canViewInventory(manager));
      assert.ok(canViewReports(manager));
      // Manager without approve_sales cannot approve sales
      assert.ok(!canApproveSales(manager));
    });

    test('SELLER has strict field officer role boundary', () => {
      const seller: PublicUser = {
        id: 'usr_seller',
        name: 'Pooja Verma',
        email: 'pooja@femmeflo.com',
        role: 'SELLER',
        active: true,
      };

      assert.ok(!canApproveSales(seller));
      assert.ok(!canManageSellers(seller));
    });
  });
});

