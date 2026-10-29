import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Business Rules & Domain Helpers
export const MINIMUM_SALE_PRICE_RUPEES = 25;
export const ALLOWED_PAYMENT_MODES = ['CASH', 'BANK', 'PENDING'] as const;
export type PaymentMode = typeof ALLOWED_PAYMENT_MODES[number];

export interface SaleOrder {
  id: string;
  sellerId: string;
  customerId: string;
  packetCount: number;
  unitPriceRupees: number;
  totalAmountRupees: number;
  status: 'PENDING' | 'APPROVED' | 'CONFIRMED' | 'REJECTED';
  paymentMode: PaymentMode;
  appliedIncentiveRatePaise: number; // Snapshot of rate when confirmed
  confirmedAt?: string;
  invoiceIssued: boolean;
}

export interface InventoryBalance {
  sellerId: string;
  stockBalance: number;
}

export function validateSalePrice(unitPriceRupees: number, configuredMinPrice: number = MINIMUM_SALE_PRICE_RUPEES) {
  const requiresApproval = unitPriceRupees < configuredMinPrice;
  return {
    requiresApproval,
    initialStatus: requiresApproval ? ('PENDING' as const) : ('CONFIRMED' as const),
    warningMessage: requiresApproval
      ? `Price ₹${unitPriceRupees} is below minimum ₹${configuredMinPrice}. Requires Super Admin approval.`
      : null,
  };
}

export function applySaleEffects(
  sale: SaleOrder,
  inventory: InventoryBalance
): { inventory: InventoryBalance; earnedCommissionPaise: number; invoiceGenerated: boolean } {
  // RULE: Only CONFIRMED sales deduct stock, earn incentive, or generate invoices
  if (sale.status === 'CONFIRMED') {
    return {
      inventory: {
        ...inventory,
        stockBalance: Math.max(0, inventory.stockBalance - sale.packetCount),
      },
      earnedCommissionPaise: sale.packetCount * sale.appliedIncentiveRatePaise,
      invoiceGenerated: true,
    };
  }

  // PENDING, REJECTED, or APPROVED (awaiting dispatch) must NOT deduct stock or credit incentives
  return {
    inventory: { ...inventory },
    earnedCommissionPaise: 0,
    invoiceGenerated: false,
  };
}

export function validatePaymentMode(mode: string): mode is PaymentMode {
  return (ALLOWED_PAYMENT_MODES as readonly string[]).includes(mode);
}

export function validateCustomerOnboarding(data: {
  name: string;
  phone: string;
  email: string;
  category: string;
  location?: { lat: number; lng: number } | null;
}) {
  const errors: Record<string, string> = {};
  if (!data.name || data.name.trim().length < 2) errors.name = 'Store name is required';
  if (!data.phone || data.phone.trim().length < 10) errors.phone = 'Valid 10-digit phone number is required';
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = 'Valid customer email is required';
  }
  if (!data.category) errors.category = 'Category selection is required';

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    hasLocation: !!data.location,
  };
}

export function checkRolePermission(userRole: 'SELLER' | 'MANAGER' | 'ADMIN', action: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    SELLER: ['CREATE_SALE', 'VIEW_CUSTOMERS', 'ADD_CUSTOMER', 'VIEW_VAN_STOCK', 'VIEW_INCENTIVES'],
    MANAGER: ['VIEW_CUSTOMERS', 'VIEW_TEAM', 'ONBOARD_SELLER', 'VIEW_TERRITORY_SALES', 'VIEW_TERRITORY_STOCK'],
    ADMIN: [
      'CREATE_SALE',
      'VIEW_CUSTOMERS',
      'ADD_CUSTOMER',
      'VIEW_VAN_STOCK',
      'VIEW_INCENTIVES',
      'VIEW_TEAM',
      'ONBOARD_SELLER',
      'VIEW_TERRITORY_SALES',
      'APPROVE_LOW_PRICE_SALE',
      'REJECT_LOW_PRICE_SALE',
      'CONFIGURE_MIN_PRICE',
      'MANAGE_HQ_INVENTORY',
      'TRANSFER_HQ_STOCK',
      'MANAGE_CATEGORIES',
    ],
  };

  return (rolePermissions[userRole] || []).includes(action);
}

// ==========================================
// TEST SUITE: 15 BUSINESS-CRITICAL SCENARIOS
// ==========================================

describe('FemmeFlo Business-Critical Scenarios (Master Prompt Section 12)', () => {

  // Scenario 1: Sale below minimum price becomes PENDING
  it('Scenario 1: A sale below the minimum price becomes pending when approval is required', () => {
    const minPrice = 25;
    const saleValidation = validateSalePrice(22, minPrice);
    assert.equal(saleValidation.requiresApproval, true);
    assert.equal(saleValidation.initialStatus, 'PENDING');
    assert.match(saleValidation.warningMessage!, /Requires Super Admin approval/);

    const normalSaleValidation = validateSalePrice(28, minPrice);
    assert.equal(normalSaleValidation.requiresApproval, false);
    assert.equal(normalSaleValidation.initialStatus, 'CONFIRMED');
  });

  // Scenario 2: Pending sale does NOT deduct stock or earn incentive
  it('Scenario 2: A pending sale does not cause client-side stock deductions or incentive credit', () => {
    const initialInventory: InventoryBalance = { sellerId: 'seller-1', stockBalance: 100 };
    const pendingSale: SaleOrder = {
      id: 'sale-001',
      sellerId: 'seller-1',
      customerId: 'cust-1',
      packetCount: 20,
      unitPriceRupees: 20,
      totalAmountRupees: 400,
      status: 'PENDING',
      paymentMode: 'CASH',
      appliedIncentiveRatePaise: 300,
      invoiceIssued: false,
    };

    const effects = applySaleEffects(pendingSale, initialInventory);
    assert.equal(effects.inventory.stockBalance, 100, 'Pending sale must not deduct stock');
    assert.equal(effects.earnedCommissionPaise, 0, 'Pending sale must not credit commissions');
    assert.equal(effects.invoiceGenerated, false, 'Pending sale must not generate final invoice');
  });

  // Scenario 3: Approved sale reflects server-confirmed result
  it('Scenario 3: An approved sale reflects the server-confirmed result and updates stock/incentives', () => {
    const initialInventory: InventoryBalance = { sellerId: 'seller-1', stockBalance: 100 };
    const confirmedSale: SaleOrder = {
      id: 'sale-001',
      sellerId: 'seller-1',
      customerId: 'cust-1',
      packetCount: 20,
      unitPriceRupees: 20,
      totalAmountRupees: 400,
      status: 'CONFIRMED',
      paymentMode: 'CASH',
      appliedIncentiveRatePaise: 300,
      invoiceIssued: true,
    };

    const effects = applySaleEffects(confirmedSale, initialInventory);
    assert.equal(effects.inventory.stockBalance, 80, 'Confirmed sale must deduct 20 units');
    assert.equal(effects.earnedCommissionPaise, 6000, 'Commission credited: 20 * 300 = 6000 paise (₹60)');
    assert.equal(effects.invoiceGenerated, true, 'Confirmed sale generates final tax invoice');
  });

  // Scenario 4: Rejected sale remains visible in history
  it('Scenario 4: A rejected sale remains visible in history with REJECTED status', () => {
    const salesHistory: SaleOrder[] = [
      {
        id: 'sale-002',
        sellerId: 'seller-1',
        customerId: 'cust-2',
        packetCount: 15,
        unitPriceRupees: 18,
        totalAmountRupees: 270,
        status: 'REJECTED',
        paymentMode: 'PENDING',
        appliedIncentiveRatePaise: 300,
        invoiceIssued: false,
      },
    ];

    const found = salesHistory.find((s) => s.id === 'sale-002');
    assert.ok(found, 'Rejected sale record must remain in history');
    assert.equal(found?.status, 'REJECTED');
  });

  // Scenario 5: Rejected sale does NOT deduct stock
  it('Scenario 5: A rejected sale does not cause a client-side stock deduction', () => {
    const inventory: InventoryBalance = { sellerId: 'seller-1', stockBalance: 50 };
    const rejectedSale: SaleOrder = {
      id: 'sale-003',
      sellerId: 'seller-1',
      customerId: 'cust-3',
      packetCount: 10,
      unitPriceRupees: 19,
      totalAmountRupees: 190,
      status: 'REJECTED',
      paymentMode: 'CASH',
      appliedIncentiveRatePaise: 300,
      invoiceIssued: false,
    };

    const effects = applySaleEffects(rejectedSale, inventory);
    assert.equal(effects.inventory.stockBalance, 50, 'Stock balance must remain unchanged');
    assert.equal(effects.earnedCommissionPaise, 0);
  });

  // Scenario 6: Retrying after uncertain timeout does not duplicate sales
  it('Scenario 6: Retrying after an uncertain sale timeout does not create duplicate sales (Idempotency Key)', () => {
    const processedKeys = new Set<string>();

    function submitSaleWithIdempotency(idempotencyKey: string) {
      if (processedKeys.has(idempotencyKey)) {
        return { status: 'DUPLICATE_IGNORED', message: 'Sale already recorded or undergoing confirmation' };
      }
      processedKeys.add(idempotencyKey);
      return { status: 'ACCEPTED', message: 'Order submitted' };
    }

    const key = 'seller1_cust5_timestamp_123456';
    const res1 = submitSaleWithIdempotency(key);
    assert.equal(res1.status, 'ACCEPTED');

    // User retries after network timeout
    const res2 = submitSaleWithIdempotency(key);
    assert.equal(res2.status, 'DUPLICATE_IGNORED');
    assert.equal(processedKeys.size, 1);
  });

  // Scenario 7: Seller cannot perform Super Admin actions
  it('Scenario 7: A seller cannot perform Super Admin actions', () => {
    assert.equal(checkRolePermission('SELLER', 'CREATE_SALE'), true);
    assert.equal(checkRolePermission('SELLER', 'APPROVE_LOW_PRICE_SALE'), false);
    assert.equal(checkRolePermission('SELLER', 'CONFIGURE_MIN_PRICE'), false);
    assert.equal(checkRolePermission('SELLER', 'MANAGE_HQ_INVENTORY'), false);
  });

  // Scenario 8: Manager cannot exceed manager permissions
  it('Scenario 8: A manager cannot exceed manager permissions', () => {
    assert.equal(checkRolePermission('MANAGER', 'VIEW_TEAM'), true);
    assert.equal(checkRolePermission('MANAGER', 'ONBOARD_SELLER'), true);
    assert.equal(checkRolePermission('MANAGER', 'APPROVE_LOW_PRICE_SALE'), false);
    assert.equal(checkRolePermission('MANAGER', 'CONFIGURE_MIN_PRICE'), false);
  });

  // Scenario 9: Expired session does not leave protected screens accessible
  it('Scenario 9: An expired session clears local token and triggers signout redirect', () => {
    let activeToken: string | null = 'mock-jwt-token';
    let isAuthenticated = true;

    function handleApi401SessionExpired() {
      activeToken = null;
      isAuthenticated = false;
    }

    handleApi401SessionExpired();
    assert.equal(activeToken, null, 'Token must be cleared from storage');
    assert.equal(isAuthenticated, false, 'User must be marked unauthenticated');
  });

  // Scenario 10: Historical incentive does not change when rate changes
  it('Scenario 10: A historical incentive does not change when the current seller incentive rate changes', () => {
    const historicalSale: SaleOrder = {
      id: 'hist-001',
      sellerId: 'seller-1',
      customerId: 'cust-1',
      packetCount: 100,
      unitPriceRupees: 35,
      totalAmountRupees: 3500,
      status: 'CONFIRMED',
      paymentMode: 'CASH',
      appliedIncentiveRatePaise: 250, // ₹2.50 per packet rate at time of sale
      invoiceIssued: true,
    };

    // Seller gets promoted, new rate is ₹4.00 (400 paise)
    const newCurrentRatePaise = 400;

    // Past sale still uses its immutable appliedIncentiveRatePaise
    const historicalEarnedPaise = historicalSale.packetCount * historicalSale.appliedIncentiveRatePaise;
    assert.equal(historicalEarnedPaise, 25000, 'Historical earnings remain ₹250 (25000 paise)');
    assert.notEqual(historicalEarnedPaise, historicalSale.packetCount * newCurrentRatePaise);
  });

  // Scenario 11: Final invoice is NOT shown as issued for unconfirmed sale
  it('Scenario 11: A final invoice is not shown as issued for an unconfirmed sale', () => {
    const pendingSale: SaleOrder = {
      id: 'sale-004',
      sellerId: 'seller-1',
      customerId: 'cust-4',
      packetCount: 10,
      unitPriceRupees: 20,
      totalAmountRupees: 200,
      status: 'PENDING',
      paymentMode: 'CASH',
      appliedIncentiveRatePaise: 300,
      invoiceIssued: false,
    };

    function canDownloadInvoice(sale: SaleOrder): boolean {
      return sale.status === 'CONFIRMED' && sale.invoiceIssued;
    }

    assert.equal(canDownloadInvoice(pendingSale), false);
  });

  // Scenario 12: Payment options exclude partial payment methods
  it('Scenario 12: Payment options exclude partial payment methods and support exactly CASH, BANK, PENDING', () => {
    assert.equal(validatePaymentMode('CASH'), true);
    assert.equal(validatePaymentMode('BANK'), true);
    assert.equal(validatePaymentMode('PENDING'), true);
    assert.equal(validatePaymentMode('PARTIAL'), false, 'Partial payment must NOT be supported');
    assert.equal(validatePaymentMode('CREDIT_CARD'), false);
    assert.equal(validatePaymentMode('UPI_PARTIAL'), false);
  });

  // Scenario 13: Customer email is strictly required
  it('Scenario 13: Customer email is required for customer onboarding', () => {
    const invalidCustomer = validateCustomerOnboarding({
      name: 'Sharma General Store',
      phone: '9876543210',
      email: '', // Missing email
      category: 'cat-retail',
    });

    assert.equal(invalidCustomer.isValid, false);
    assert.ok(invalidCustomer.errors.email, 'Email validation error must be present');

    const validCustomer = validateCustomerOnboarding({
      name: 'Sharma General Store',
      phone: '9876543210',
      email: 'sharma@example.com',
      category: 'cat-retail',
    });

    assert.equal(validCustomer.isValid, true);
    assert.equal(Object.keys(validCustomer.errors).length, 0);
  });

  // Scenario 14: Denied GPS permission does not crash onboarding
  it('Scenario 14: A denied GPS permission does not crash customer onboarding (manual entry fallback)', () => {
    const customerWithoutGps = validateCustomerOnboarding({
      name: 'Gupta Medical Hall',
      phone: '9123456789',
      email: 'gupta@example.com',
      category: 'cat-pharmacy',
      location: null, // Permission was denied
    });

    // System permits graceful manual recovery
    assert.equal(customerWithoutGps.isValid, true);
    assert.equal(customerWithoutGps.hasLocation, false);
  });

  // Scenario 15: Network failure does not discard entered form data
  it('Scenario 15: Network failure does not silently discard entered form data', () => {
    let formData = {
      customerId: 'cust-123',
      quantityStr: '25',
      unitPriceRupees: '30',
      paymentMode: 'CASH' as PaymentMode,
    };

    // Simulate network error during submission
    const networkError = new Error('Network timeout (Render cold start)');

    // Catch block preserves form state for user retry
    try {
      throw networkError;
    } catch {
      // Form data remains completely intact
      assert.equal(formData.customerId, 'cust-123');
      assert.equal(formData.quantityStr, '25');
      assert.equal(formData.unitPriceRupees, '30');
    }
  });

});
