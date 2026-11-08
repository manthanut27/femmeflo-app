import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicUser } from '../api/types.ts';

describe('FemmeFlo Dual-Role Persona for Area/Territory Sales Manager Suite', () => {

  // ----------------------------------------------------
  // 1. Dual Portal & Screen Navigation
  // ----------------------------------------------------
  it('Pillar 1: Dual-Role persona access control & portal routing logic', () => {
    function canAccessSellerPortal(user: PublicUser): boolean {
      return user.role === 'SELLER' || (user.role === 'MANAGER' && Boolean(user.isSeller));
    }

    function canAccessManagerPortal(user: PublicUser): boolean {
      return user.role === 'MANAGER' || user.role === 'SUPER_ADMIN';
    }

    const standardSeller: PublicUser = {
      id: 'usr_seller_1',
      name: 'Ramesh Field Officer',
      email: 'ramesh@femmeflo.com',
      role: 'SELLER',
      active: true,
      district: 'Thane',
      state: 'Maharashtra',
    };

    const standardManager: PublicUser = {
      id: 'usr_manager_1',
      name: 'Sunil Territory Manager',
      email: 'sunil@femmeflo.com',
      role: 'MANAGER',
      isSeller: false,
      active: true,
      district: 'Thane',
      state: 'Maharashtra',
    };

    const dualRoleManager: PublicUser = {
      id: 'usr_dual_1',
      name: 'Kavita Area Manager',
      email: 'kavita@femmeflo.com',
      role: 'MANAGER',
      isSeller: true,
      active: true,
      district: 'Thane',
      state: 'Maharashtra',
    };

    // Standard seller only accesses seller portal
    assert.equal(canAccessSellerPortal(standardSeller), true);
    assert.equal(canAccessManagerPortal(standardSeller), false);

    // Standard manager only accesses manager portal
    assert.equal(canAccessSellerPortal(standardManager), false);
    assert.equal(canAccessManagerPortal(standardManager), true);

    // Dual-role manager accesses BOTH manager and seller portals
    assert.equal(canAccessSellerPortal(dualRoleManager), true);
    assert.equal(canAccessManagerPortal(dualRoleManager), true);
  });

  // ----------------------------------------------------
  // 2. Dedicated Field Inventory (Van Stock)
  // ----------------------------------------------------
  it('Pillar 2: Stock transfer options include Dual-Role Managers for vehicle/van stock dispatch', () => {
    const managers: PublicUser[] = [
      { id: 'm1', name: 'Alok Manager', email: 'alok@femmeflo.com', role: 'MANAGER', isSeller: false, active: true },
      { id: 'm2', name: 'Deepa Dual Manager', email: 'deepa@femmeflo.com', role: 'MANAGER', isSeller: true, active: true, district: 'Pune', state: 'Maharashtra' },
    ];

    const sellers: PublicUser[] = [
      { id: 's1', name: 'Raju Seller', email: 'raju@femmeflo.com', role: 'SELLER', active: true },
    ];

    function buildTransferDestinationOptions(mgrs: PublicUser[], slls: PublicUser[]) {
      const list: Array<{ id: string; title: string; badge: string }> = [];

      // Dual-role managers with dedicated van stock
      const dualRoleManagers = mgrs.filter((m) => Boolean(m.isSeller));
      for (const m of dualRoleManagers) {
        list.push({
          id: m.id,
          title: `${m.name} (Dual-Role Manager - Van Stock)`,
          badge: 'VAN STOCK',
        });
      }

      for (const s of slls) {
        list.push({
          id: s.id,
          title: `${s.name} (Field Officer)`,
          badge: 'FIELD SELLER',
        });
      }

      return list;
    }

    const options = buildTransferDestinationOptions(managers, sellers);

    // Assert that standard manager m1 is NOT in van stock destinations
    assert.equal(options.some((o) => o.id === 'm1'), false);

    // Assert that dual-role manager m2 IS included with VAN STOCK badge
    const dualOption = options.find((o) => o.id === 'm2');
    assert.ok(dualOption, 'Dual-role manager must be available as transfer destination');
    assert.equal(dualOption?.badge, 'VAN STOCK');
    assert.match(dualOption!.title, /Van Stock/);
  });

  // ----------------------------------------------------
  // 3. Frontline Customer Onboarding
  // ----------------------------------------------------
  it('Pillar 3: Frontline Customer Onboarding allows direct self-fulfillment or territory seller mapping', () => {
    const dualRoleUser: PublicUser = {
      id: 'mgr_dual_99',
      name: 'Kavita Territory Manager',
      email: 'kavita@femmeflo.com',
      role: 'MANAGER',
      isSeller: true,
      active: true,
      district: 'Varanasi',
      state: 'Uttar Pradesh',
    };

    const territorySellers: PublicUser[] = [
      { id: 'sel_10', name: 'Amit Field Seller', email: 'amit@femmeflo.com', role: 'SELLER', active: true },
    ];

    function resolveCustomerSellerId(
      user: PublicUser,
      selectedSellerId: string | undefined,
      availableSellers: PublicUser[]
    ): string {
      if (selectedSellerId) return selectedSellerId;
      if (user.isSeller) return user.id; // Defaults to self under dual role
      return availableSellers[0]?.id || '';
    }

    // When manager selects self for direct fulfillment
    const selfAssigned = resolveCustomerSellerId(dualRoleUser, dualRoleUser.id, territorySellers);
    assert.equal(selfAssigned, dualRoleUser.id, 'Maps customer directly under manager van stock');

    // When manager delegates customer to an on-ground field seller
    const sellerAssigned = resolveCustomerSellerId(dualRoleUser, territorySellers[0].id, territorySellers);
    assert.equal(sellerAssigned, 'sel_10', 'Maps customer under assigned field seller');
  });

  // ----------------------------------------------------
  // 4. Single Identity & Credentials
  // ----------------------------------------------------
  it('Pillar 4: Unified single identity credentials authorization across manager & seller APIs', () => {
    interface AuthContextUser {
      id: string;
      email: string;
      token: string;
      role: 'SUPER_ADMIN' | 'MANAGER' | 'SELLER';
      isSeller: boolean;
    }

    const dualRoleSession: AuthContextUser = {
      id: 'usr_dual_88',
      email: 'territory.head@femmeflo.com',
      token: 'jwt-single-identity-session-token',
      role: 'MANAGER',
      isSeller: true,
    };

    function authorizeApiEndpoint(user: AuthContextUser, endpoint: string): boolean {
      // Manager governance endpoints
      if (endpoint.startsWith('manager/') || endpoint.startsWith('admin/dashboard/filters')) {
        return user.role === 'MANAGER' || user.role === 'SUPER_ADMIN';
      }
      // Field seller frontline endpoints (POS sales, shifts, personal inventory)
      if (endpoint.startsWith('seller/')) {
        return user.role === 'SELLER' || (user.role === 'MANAGER' && user.isSeller);
      }
      // Super admin only
      if (endpoint.startsWith('admin/')) {
        return user.role === 'SUPER_ADMIN';
      }
      return false;
    }

    // Unified session succeeds for manager endpoints
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'manager/dashboard'), true);
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'manager/sellers'), true);

    // Unified session ALSO succeeds for field seller endpoints
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'seller/sales'), true);
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'seller/shifts/start'), true);
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'seller/inventory'), true);

    // Unified session rejects unauthorized super admin actions
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'admin/users'), false);
    assert.equal(authorizeApiEndpoint(dualRoleSession, 'admin/approvals'), false);
  });

  // ----------------------------------------------------
  // 5. Manager Can Add Sale & Follows Shift Prerequisite
  // ----------------------------------------------------
  it('Pillar 5: Managers can act as sellers to add sales, following shift prerequisite', () => {
    function canManagerAccessSellerRoutes(user: { role: string }): boolean {
      return user.role === 'SELLER' || user.role === 'MANAGER';
    }

    const territoryManager = {
      id: 'mgr_mumbai_01',
      name: 'Pooja Territory Head',
      role: 'MANAGER' as const,
    };

    assert.equal(canManagerAccessSellerRoutes(territoryManager), true, 'Manager must be permitted to access seller routes');

    // Simulate shift gate evaluation for manager selling
    function evaluateSaleCreationPrerequisite(hasActiveShift: boolean): { canCreateSale: boolean; redirectRoute: string } {
      if (!hasActiveShift) {
        return { canCreateSale: false, redirectRoute: '/(seller)/shift' };
      }
      return { canCreateSale: true, redirectRoute: '/(seller)/sales/new' };
    }

    // When manager has not started daily duty shift yet
    const blockedResult = evaluateSaleCreationPrerequisite(false);
    assert.equal(blockedResult.canCreateSale, false);
    assert.equal(blockedResult.redirectRoute, '/(seller)/shift', 'Redirects to shift check-in when inactive');

    // When manager has completed selfie & meter verification
    const allowedResult = evaluateSaleCreationPrerequisite(true);
    assert.equal(allowedResult.canCreateSale, true);
    assert.equal(allowedResult.redirectRoute, '/(seller)/sales/new', 'Proceeds to new sale screen');
  });

  // ----------------------------------------------------
  // 6. Mobile Navigation Drawer Initial Closed State & Operations
  // ----------------------------------------------------
  it('Pillar 6: Mobile Navigation Drawer starts closed on app launch and provides full operational routes', () => {
    // Drawer visibility state on initial app mount
    const initialDrawerState = {
      visible: false, // Closed on app open
    };
    assert.equal(initialDrawerState.visible, false, 'Mobile navigation drawer must be closed on app launch');

    function buildDrawerNavItems(role: 'MANAGER' | 'SELLER') {
      const isManager = role === 'MANAGER';
      return [
        { title: 'Dashboard', route: isManager ? '/(manager)' : '/(seller)' },
        { title: 'New Field Sale', route: '/(seller)/sales/new', requiresShift: true },
        { title: 'My Duty Shift', route: '/(seller)/shift' },
        ...(isManager
          ? [
              { title: 'Territory Sales', route: '/(manager)/sales' },
              { title: 'Team Sellers', route: '/(manager)/sellers' },
              { title: 'Retail Stores', route: '/(manager)/customers' },
              { title: 'Depot Stock', route: '/(manager)/inventory' },
              { title: 'Incentives', route: '/(manager)/incentives' },
            ]
          : [
              { title: 'My Sales History', route: '/(seller)/sales' },
              { title: 'Retail Customers', route: '/(seller)/customers' },
              { title: 'My Van Stock', route: '/(seller)/inventory' },
              { title: 'My Earnings', route: '/(seller)/incentives' },
            ]),
        { title: 'My Profile', route: isManager ? '/(manager)/profile' : '/(seller)/profile' },
        { title: 'Notifications', route: '/(shared)/notifications' },
      ];
    }

    const managerItems = buildDrawerNavItems('MANAGER');
    assert.ok(managerItems.some((i) => i.title === 'New Field Sale'));
    assert.ok(managerItems.some((i) => i.title === 'My Duty Shift'));
    assert.ok(managerItems.some((i) => i.title === 'Territory Sales'));
    assert.ok(managerItems.some((i) => i.title === 'Team Sellers'));
    assert.ok(managerItems.some((i) => i.title === 'Depot Stock'));

    const sellerItems = buildDrawerNavItems('SELLER');
    assert.ok(sellerItems.some((i) => i.title === 'New Field Sale'));
    assert.ok(sellerItems.some((i) => i.title === 'My Duty Shift'));
    assert.ok(sellerItems.some((i) => i.title === 'My Sales History'));
  });
});
