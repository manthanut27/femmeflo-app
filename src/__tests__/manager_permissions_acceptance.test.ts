import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  canMonitorStock,
  canOnboardCustomers,
  canOnboardSellers,
  canViewCustomers,
  canViewSellers,
  syncPermissionAliases,
} from '../utils/permissions.ts';
import {
  MOCK_ALL_MANAGERS,
  MOCK_USERS,
} from '../api/mockData.ts';
import type { PublicUser } from '../api/types.ts';

describe('Manager Initial Operational Permissions Acceptance Suite', () => {
  describe('1. Permission Aliases and Synchronization', () => {
    test('synchronizes view_sellers with canonical SELLER_READ', () => {
      const perms = syncPermissionAliases(['view_sellers']);
      assert.ok(perms.includes('view_sellers'));
      assert.ok(perms.includes('SELLER_READ'));
    });

    test('synchronizes onboard_sellers with canonical SELLER_CREATE', () => {
      const perms = syncPermissionAliases(['onboard_sellers']);
      assert.ok(perms.includes('onboard_sellers'));
      assert.ok(perms.includes('SELLER_CREATE'));
    });

    test('synchronizes both view_sellers and onboard_sellers with manage_sellers', () => {
      const perms = syncPermissionAliases(['view_sellers', 'onboard_sellers']);
      assert.ok(perms.includes('view_sellers'));
      assert.ok(perms.includes('onboard_sellers'));
      assert.ok(perms.includes('SELLER_READ'));
      assert.ok(perms.includes('SELLER_CREATE'));
      assert.ok(perms.includes('manage_sellers'));
    });

    test('synchronizes view_customers with canonical CUSTOMER_READ', () => {
      const perms = syncPermissionAliases(['view_customers']);
      assert.ok(perms.includes('view_customers'));
      assert.ok(perms.includes('CUSTOMER_READ'));
    });

    test('synchronizes onboard_customers with canonical CUSTOMER_CREATE and view access', () => {
      const perms = syncPermissionAliases(['onboard_customers']);
      assert.ok(perms.includes('onboard_customers'));
      assert.ok(perms.includes('CUSTOMER_CREATE'));
      assert.ok(perms.includes('view_customers'));
      assert.ok(perms.includes('CUSTOMER_READ'));
    });

    test('synchronizes monitor_stock with canonical view_inventory and INVENTORY_READ', () => {
      const perms = syncPermissionAliases(['monitor_stock']);
      assert.ok(perms.includes('monitor_stock'));
      assert.ok(perms.includes('view_inventory'));
      assert.ok(perms.includes('INVENTORY_READ'));
    });

    test('synchronizes all 5 initial operational permissions simultaneously without duplicates', () => {
      const initial = [
        'view_sellers',
        'onboard_sellers',
        'view_customers',
        'onboard_customers',
        'monitor_stock',
      ];
      const synced = syncPermissionAliases(initial);
      const unique = Array.from(new Set(synced));
      assert.equal(synced.length, unique.length);
      const expectedKeys = [
        'view_sellers',
        'onboard_sellers',
        'view_customers',
        'onboard_customers',
        'monitor_stock',
        'manage_sellers',
        'SELLER_READ',
        'SELLER_CREATE',
        'CUSTOMER_READ',
        'CUSTOMER_CREATE',
        'view_inventory',
        'INVENTORY_READ',
      ];
      for (const k of expectedKeys) {
        assert.ok(synced.includes(k), `Missing expected key: ${k}`);
      }
    });
  });

  describe('2. Manager Helper Function Evaluation', () => {
    test('grants full access to SUPER_ADMIN regardless of permissions array', () => {
      const adminUser: PublicUser = {
        id: 'usr_admin',
        name: 'Super Admin',
        email: 'admin@femmeflo.in',
        role: 'SUPER_ADMIN',
        active: true,
        permissions: [],
      };
      assert.equal(canViewSellers(adminUser), true);
      assert.equal(canOnboardSellers(adminUser), true);
      assert.equal(canViewCustomers(adminUser), true);
      assert.equal(canOnboardCustomers(adminUser), true);
      assert.equal(canMonitorStock(adminUser), true);
    });

    test('allows manager with unassigned permissions (legacy/fallback) for backward compatibility', () => {
      const legacyManager: PublicUser = {
        id: 'usr_mgr_legacy',
        name: 'Legacy Manager',
        email: 'legacy@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: undefined,
      };
      assert.equal(canViewSellers(legacyManager), true);
      assert.equal(canOnboardSellers(legacyManager), true);
      assert.equal(canViewCustomers(legacyManager), true);
      assert.equal(canOnboardCustomers(legacyManager), true);
      assert.equal(canMonitorStock(legacyManager), true);
    });

    test('strictly denies all operations when manager permissions array is empty []', () => {
      const restrictedManager: PublicUser = {
        id: 'usr_mgr_empty',
        name: 'Empty Permissions Manager',
        email: 'empty@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: [],
      };
      assert.equal(canViewSellers(restrictedManager), false);
      assert.equal(canOnboardSellers(restrictedManager), false);
      assert.equal(canViewCustomers(restrictedManager), false);
      assert.equal(canOnboardCustomers(restrictedManager), false);
      assert.equal(canMonitorStock(restrictedManager), false);
    });

    test('strictly isolates individual operational permissions', () => {
      // 1. Only view_sellers
      const sellerViewer: PublicUser = {
        id: 'usr_mgr_sv',
        name: 'Seller Viewer',
        email: 'sv@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: syncPermissionAliases(['view_sellers']),
      };
      assert.equal(canViewSellers(sellerViewer), true);
      assert.equal(canOnboardSellers(sellerViewer), false);
      assert.equal(canViewCustomers(sellerViewer), false);
      assert.equal(canOnboardCustomers(sellerViewer), false);
      assert.equal(canMonitorStock(sellerViewer), false);

      // 2. Only onboard_sellers
      const sellerOnboarder: PublicUser = {
        id: 'usr_mgr_so',
        name: 'Seller Onboarder',
        email: 'so@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: syncPermissionAliases(['onboard_sellers']),
      };
      assert.equal(canViewSellers(sellerOnboarder), false);
      assert.equal(canOnboardSellers(sellerOnboarder), true);
      assert.equal(canViewCustomers(sellerOnboarder), false);
      assert.equal(canOnboardCustomers(sellerOnboarder), false);
      assert.equal(canMonitorStock(sellerOnboarder), false);

      // 3. Only view_customers
      const customerViewer: PublicUser = {
        id: 'usr_mgr_cv',
        name: 'Customer Viewer',
        email: 'cv@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: syncPermissionAliases(['view_customers']),
      };
      assert.equal(canViewSellers(customerViewer), false);
      assert.equal(canOnboardSellers(customerViewer), false);
      assert.equal(canViewCustomers(customerViewer), true);
      assert.equal(canOnboardCustomers(customerViewer), false);
      assert.equal(canMonitorStock(customerViewer), false);

      // 4. Only onboard_customers (inherently grants view_customers)
      const customerOnboarder: PublicUser = {
        id: 'usr_mgr_co',
        name: 'Customer Onboarder',
        email: 'co@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: syncPermissionAliases(['onboard_customers']),
      };
      assert.equal(canViewSellers(customerOnboarder), false);
      assert.equal(canOnboardSellers(customerOnboarder), false);
      assert.equal(canViewCustomers(customerOnboarder), true);
      assert.equal(canOnboardCustomers(customerOnboarder), true);
      assert.equal(canMonitorStock(customerOnboarder), false);

      // 5. Only monitor_stock
      const stockMonitor: PublicUser = {
        id: 'usr_mgr_sm',
        name: 'Stock Monitor',
        email: 'sm@femmeflo.in',
        role: 'MANAGER',
        active: true,
        permissions: syncPermissionAliases(['monitor_stock']),
      };
      assert.equal(canViewSellers(stockMonitor), false);
      assert.equal(canOnboardSellers(stockMonitor), false);
      assert.equal(canViewCustomers(stockMonitor), false);
      assert.equal(canOnboardCustomers(stockMonitor), false);
      assert.equal(canMonitorStock(stockMonitor), true);
    });
  });

  describe('3. Mock Users and Onboarding Consistency', () => {
    test('default MOCK_USERS.manager has all 5 initial operational permissions synced', () => {
      const mgr = MOCK_USERS.manager;
      assert.equal(canViewSellers(mgr), true);
      assert.equal(canOnboardSellers(mgr), true);
      assert.equal(canViewCustomers(mgr), true);
      assert.equal(canOnboardCustomers(mgr), true);
      assert.equal(canMonitorStock(mgr), true);
    });

    test('all regional depot managers in MOCK_ALL_MANAGERS have operational permissions', () => {
      for (const mgr of MOCK_ALL_MANAGERS) {
        assert.equal(canViewSellers(mgr), true, `Manager ${mgr.id} failed canViewSellers`);
        assert.equal(canOnboardSellers(mgr), true, `Manager ${mgr.id} failed canOnboardSellers`);
        assert.equal(canViewCustomers(mgr), true, `Manager ${mgr.id} failed canViewCustomers`);
        assert.equal(canOnboardCustomers(mgr), true, `Manager ${mgr.id} failed canOnboardCustomers`);
        assert.equal(canMonitorStock(mgr), true, `Manager ${mgr.id} failed canMonitorStock`);
      }
    });
  });
});
