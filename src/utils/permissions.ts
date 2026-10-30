import type { PublicUser } from '../api/types';

// Supported manager permission keys in backend
export const MANAGER_PERMISSIONS = [
  'onboard_customers',
  'view_customers',
  'manage_sellers',
  'view_inventory',
  'transfer_inventory',
  'approve_sales',
  'view_reports',
] as const;

export type ManagerPermissionKey = (typeof MANAGER_PERMISSIONS)[number];

// Backend canonical permission set
export const ALL_BACKEND_PERMISSIONS = [
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
] as const;

// Friendly labels and descriptions for backend permission keys
export const PERMISSION_METADATA: Record<string, { label: string; description: string }> = {
  onboard_customers: {
    label: 'Onboard Customers',
    description: 'Allow manager to register and edit retail shop customers in their territory',
  },
  view_customers: {
    label: 'View Customers',
    description: 'Allow manager to view customer directory and contact information',
  },
  manage_sellers: {
    label: 'Manage Field Officers',
    description: 'Allow manager to onboard and supervise field sales officers',
  },
  view_inventory: {
    label: 'View Inventory',
    description: 'Allow manager to inspect regional warehouse stock levels and packet allocations',
  },
  transfer_inventory: {
    label: 'Transfer Inventory',
    description: 'Allow manager to allocate packet batches from warehouse to field officers',
  },
  approve_sales: {
    label: 'Approve Sales',
    description: 'Allow manager to verify recorded sales transactions and audit history',
  },
  view_reports: {
    label: 'View Reports',
    description: 'Allow manager to access territory sales summaries and performance analytics',
  },
};

// Aliases for compatibility between legacy uppercase and action keys
const PERMISSION_ALIASES: Record<string, string[]> = {
  onboard_customers: ['onboard_customers', 'CUSTOMER_CREATE'],
  CUSTOMER_CREATE: ['onboard_customers', 'CUSTOMER_CREATE'],
  view_customers: ['view_customers', 'CUSTOMER_READ', 'onboard_customers', 'CUSTOMER_CREATE'],
  CUSTOMER_READ: ['view_customers', 'CUSTOMER_READ', 'onboard_customers', 'CUSTOMER_CREATE'],
  manage_sellers: ['manage_sellers', 'SELLER_CREATE', 'SELLER_READ'],
  SELLER_CREATE: ['manage_sellers', 'SELLER_CREATE', 'SELLER_READ'],
  SELLER_READ: ['manage_sellers', 'SELLER_READ', 'SELLER_CREATE'],
  view_inventory: ['view_inventory', 'INVENTORY_READ'],
  INVENTORY_READ: ['view_inventory', 'INVENTORY_READ'],
  transfer_inventory: ['transfer_inventory'],
  approve_sales: ['approve_sales', 'SALES_READ'],
  SALES_READ: ['approve_sales', 'SALES_READ'],
  view_reports: ['view_reports'],
};

export function hasPermission(
  user: PublicUser | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  const userPerms = user.permissions || [];
  if (userPerms.includes(permission)) return true;

  const aliases = PERMISSION_ALIASES[permission];
  if (aliases && aliases.some((alias) => userPerms.includes(alias))) {
    return true;
  }

  return false;
}

export function syncPermissionAliases(permissions: string[]): string[] {
  const set = new Set<string>(permissions);
  if (set.has('onboard_customers')) set.add('CUSTOMER_CREATE');
  if (set.has('view_customers')) set.add('CUSTOMER_READ');
  if (set.has('manage_sellers')) {
    set.add('SELLER_CREATE');
    set.add('SELLER_READ');
  }
  if (set.has('view_inventory')) set.add('INVENTORY_READ');
  if (set.has('approve_sales')) set.add('SALES_READ');
  return Array.from(set);
}

export function canOnboardCustomers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'onboard_customers');
}

export function canViewCustomers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'view_customers') || hasPermission(user, 'onboard_customers');
}

export function canManageSellers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'manage_sellers');
}

export function canViewInventory(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'view_inventory');
}

export function canApproveSales(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'approve_sales');
}

export function canViewReports(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'view_reports');
}

