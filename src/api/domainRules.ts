/**
 * FemmeFlo Core Domain Rules & Invariants
 * Authoritative business rules shared across mobile app screens and automated tests.
 */
import type { AuthRole, PaymentMode, SaleStatus } from './types';

export const MINIMUM_SALE_PRICE_RUPEES = 25;
export const ALLOWED_PAYMENT_MODES = ['CASH', 'BANK', 'PENDING'] as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCustomerEmail(email: string): boolean {
  return EMAIL_REGEX.test((email || '').trim());
}

export function validateSalePrice(unitPriceRupees: number, configuredMinPrice: number = MINIMUM_SALE_PRICE_RUPEES) {
  const requiresApproval = unitPriceRupees < configuredMinPrice;
  return {
    requiresApproval,
    initialStatus: requiresApproval ? ('PENDING' as SaleStatus) : ('CONFIRMED' as SaleStatus),
    warningMessage: requiresApproval
      ? `Price ₹${unitPriceRupees} is below minimum ₹${configuredMinPrice}. Requires Super Admin approval.`
      : null,
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
  if (!data.email || !validateCustomerEmail(data.email)) {
    errors.email = 'Valid customer email is required';
  }
  if (!data.category) errors.category = 'Category selection is required';

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    hasLocation: !!data.location,
  };
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SELLER: ['CREATE_SALE', 'VIEW_CUSTOMERS', 'ADD_CUSTOMER', 'VIEW_VAN_STOCK', 'VIEW_INCENTIVES'],
  MANAGER: ['VIEW_CUSTOMERS', 'VIEW_TEAM', 'ONBOARD_SELLER', 'VIEW_TERRITORY_SALES', 'VIEW_TERRITORY_STOCK'],
  SUPER_ADMIN: [
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

export function checkRolePermission(userRole: AuthRole | 'ADMIN' | string, action: string): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(action);
}

export function applySaleEffects(
  sale: { packetCount: number; status: SaleStatus; appliedIncentiveRatePaise?: number },
  inventory: { stockBalance: number }
): { inventory: { stockBalance: number }; earnedCommissionPaise: number; invoiceGenerated: boolean } {
  const rate = sale.appliedIncentiveRatePaise || 0;
  if (sale.status === 'CONFIRMED') {
    return {
      inventory: {
        stockBalance: Math.max(0, inventory.stockBalance - sale.packetCount),
      },
      earnedCommissionPaise: sale.packetCount * rate,
      invoiceGenerated: true,
    };
  }

  return {
    inventory: { ...inventory },
    earnedCommissionPaise: 0,
    invoiceGenerated: false,
  };
}
