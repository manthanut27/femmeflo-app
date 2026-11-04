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

// Friendly labels and descriptions for backend permission keys & operational keys
export const PERMISSION_METADATA: Record<string, { label: string; description: string }> = {
  view_sellers: {
    label: 'View Field Officers',
    description: 'Allow manager to view assigned field sales officers and their beat territories',
  },
  onboard_sellers: {
    label: 'Onboard Field Officers',
    description: 'Allow manager to register and provision new field sales officers',
  },
  manage_sellers: {
    label: 'Manage Field Officers',
    description: 'Allow manager to onboard and supervise field sales officers',
  },
  view_customers: {
    label: 'View Customers',
    description: 'Allow manager to view customer directory and contact information',
  },
  onboard_customers: {
    label: 'Onboard Customers',
    description: 'Allow manager to register and edit retail shop customers in their territory',
  },
  monitor_stock: {
    label: 'Monitor Territory Stock',
    description: 'Allow manager to monitor regional warehouse inventory and van stock levels',
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

// Bi-directional aliases connecting onboarding operational keys, canonical keys, and legacy uppercase keys
const PERMISSION_ALIASES: Record<string, string[]> = {
  // Onboard customers
  onboard_customers: ['onboard_customers', 'CUSTOMER_CREATE'],
  CUSTOMER_CREATE: ['onboard_customers', 'CUSTOMER_CREATE'],

  // View customers
  view_customers: ['view_customers', 'CUSTOMER_READ', 'onboard_customers', 'CUSTOMER_CREATE'],
  CUSTOMER_READ: ['view_customers', 'CUSTOMER_READ', 'onboard_customers', 'CUSTOMER_CREATE'],

  // Field sellers
  view_sellers: ['view_sellers', 'manage_sellers', 'SELLER_READ'],
  onboard_sellers: ['onboard_sellers', 'manage_sellers', 'SELLER_CREATE'],
  manage_sellers: ['manage_sellers', 'view_sellers', 'onboard_sellers', 'SELLER_CREATE', 'SELLER_READ'],
  SELLER_CREATE: ['onboard_sellers', 'manage_sellers', 'SELLER_CREATE'],
  SELLER_READ: ['view_sellers', 'manage_sellers', 'SELLER_READ'],

  // Inventory & Stock
  monitor_stock: ['monitor_stock', 'view_inventory', 'INVENTORY_READ'],
  view_inventory: ['view_inventory', 'monitor_stock', 'INVENTORY_READ'],
  INVENTORY_READ: ['view_inventory', 'monitor_stock', 'INVENTORY_READ'],
  transfer_inventory: ['transfer_inventory'],

  // Sales & Reports
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
  if (user.role !== 'MANAGER') return false;

  const userPerms = user.permissions;
  // Fail-closed: missing or non-array permissions is treated as having no permissions
  if (!userPerms || !Array.isArray(userPerms)) {
    return false;
  }

  if (userPerms.includes(permission)) return true;

  const aliases = PERMISSION_ALIASES[permission];
  if (aliases && aliases.some((alias) => userPerms.includes(alias))) {
    return true;
  }

  return false;
}

export function syncPermissionAliases(permissions: string[]): string[] {
  const set = new Set<string>(permissions);

  // Sync Customer permissions
  if (set.has('onboard_customers') || set.has('CUSTOMER_CREATE')) {
    set.add('onboard_customers');
    set.add('CUSTOMER_CREATE');
    set.add('view_customers');
    set.add('CUSTOMER_READ');
  }
  if (set.has('view_customers') || set.has('CUSTOMER_READ')) {
    set.add('view_customers');
    set.add('CUSTOMER_READ');
  }

  // Sync Seller permissions
  if (set.has('manage_sellers')) {
    set.add('SELLER_CREATE');
    set.add('SELLER_READ');
    set.add('view_sellers');
    set.add('onboard_sellers');
  }
  if (set.has('view_sellers') || set.has('SELLER_READ')) {
    set.add('view_sellers');
    set.add('SELLER_READ');
  }
  if (set.has('onboard_sellers') || set.has('SELLER_CREATE')) {
    set.add('onboard_sellers');
    set.add('SELLER_CREATE');
  }
  if (set.has('view_sellers') && set.has('onboard_sellers')) {
    set.add('manage_sellers');
  }

  // Sync Inventory permissions
  if (set.has('view_inventory') || set.has('INVENTORY_READ') || set.has('monitor_stock')) {
    set.add('view_inventory');
    set.add('INVENTORY_READ');
    set.add('monitor_stock');
  }

  // Sync Sales permissions
  if (set.has('approve_sales') || set.has('SALES_READ')) {
    set.add('approve_sales');
    set.add('SALES_READ');
  }

  return Array.from(set);
}

// -----------------------------------------------------------------------
// Operational Permission Helper Functions
// -----------------------------------------------------------------------

export function canViewSellers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'view_sellers');
}

export function canOnboardSellers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'onboard_sellers');
}

export function canManageSellers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'manage_sellers');
}

export function canViewCustomers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'view_customers');
}

export function canOnboardCustomers(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'onboard_customers');
}

export function canMonitorStock(user: PublicUser | null | undefined): boolean {
  return hasPermission(user, 'monitor_stock');
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
