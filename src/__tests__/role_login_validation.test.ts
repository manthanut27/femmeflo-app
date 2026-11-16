import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLoginRoleSection,
  checkIdentifierForRoleSection,
  resolveKnownUserRole,
  type LoginRoleSection,
} from '../utils/roleLoginValidator.ts';
import { MOCK_USERS, MOCK_ALL_MANAGERS, MOCK_ALL_SELLERS } from '../api/mockData.ts';

describe('FemmeFlo Role-Based Login Validation & Error Messaging Test Suite', () => {

  // =========================================================================
  // 1. SELLER SECTION RULES ('seller')
  // =========================================================================
  describe('1. Seller Section Rules (Field Seller tab)', () => {
    it('allows standard SELLER to log in', () => {
      const seller = { role: 'SELLER' };
      const res = validateLoginRoleSection('seller', seller);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('allows standard SELLER with explicit isSeller: false (role takes precedence)', () => {
      const seller = { role: 'SELLER', isSeller: false };
      const res = validateLoginRoleSection('seller', seller);
      assert.equal(res.isValid, true);
    });

    it('allows SELLER with lowercase role strings (case-insensitivity)', () => {
      const res = validateLoginRoleSection('seller', { role: 'seller' });
      assert.equal(res.isValid, true);
    });

    it('allows Dual-Role MANAGER (role: MANAGER, isSeller: true) to log in', () => {
      const dualRoleManager = { role: 'MANAGER', isSeller: true };
      const res = validateLoginRoleSection('seller', dualRoleManager);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('rejects standard MANAGER (role: MANAGER, isSeller: false) with clear guidance to switch to Territory Manager tab', () => {
      const standardManager = { role: 'MANAGER', isSeller: false };
      const res = validateLoginRoleSection('seller', standardManager);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'manager');
      assert.match(res.error || '', /Territory Manager/i);
      assert.match(res.error || '', /switch to the Territory Manager tab/i);
    });

    it('rejects standard MANAGER without isSeller property defined', () => {
      const standardManager = { role: 'MANAGER' };
      const res = validateLoginRoleSection('seller', standardManager);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'manager');
      assert.match(res.error || '', /Territory Manager/i);
    });

    it('rejects SUPER_ADMIN with clear guidance to switch to Super Admin tab', () => {
      const admin = { role: 'SUPER_ADMIN' };
      const res = validateLoginRoleSection('seller', admin);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'admin');
      assert.match(res.error || '', /Super Admin/i);
      assert.match(res.error || '', /switch to the Super Admin tab/i);
    });

    it('rejects unrecognized roles in seller portal', () => {
      const unknown = { role: 'AUDITOR' };
      const res = validateLoginRoleSection('seller', unknown);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /not recognized/i);
    });

    it('rejects invalid or null user object safely', () => {
      const resNull = validateLoginRoleSection('seller', null as any);
      assert.equal(resNull.isValid, false);
      assert.match(resNull.error || '', /invalid/i);

      const resEmpty = validateLoginRoleSection('seller', {} as any);
      assert.equal(resEmpty.isValid, false);
    });
  });

  // =========================================================================
  // 2. MANAGER SECTION RULES ('manager')
  // =========================================================================
  describe('2. Manager Section Rules (Territory Manager tab)', () => {
    it('allows standard MANAGER (role: MANAGER, isSeller: false) to log in', () => {
      const standardManager = { role: 'MANAGER', isSeller: false };
      const res = validateLoginRoleSection('manager', standardManager);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('allows standard MANAGER with isSeller undefined to log in', () => {
      const standardManager = { role: 'MANAGER' };
      const res = validateLoginRoleSection('manager', standardManager);
      assert.equal(res.isValid, true);
    });

    it('allows Dual-Role MANAGER (role: MANAGER, isSeller: true) to log in', () => {
      const dualRoleManager = { role: 'MANAGER', isSeller: true };
      const res = validateLoginRoleSection('manager', dualRoleManager);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('allows MANAGER with lowercase role strings (case-insensitivity)', () => {
      const res = validateLoginRoleSection('manager', { role: 'manager' });
      assert.equal(res.isValid, true);
    });

    it('rejects SELLER with clear guidance to switch to Field Seller tab', () => {
      const seller = { role: 'SELLER' };
      const res = validateLoginRoleSection('manager', seller);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'seller');
      assert.match(res.error || '', /Field Seller/i);
      assert.match(res.error || '', /switch to the Field Seller tab/i);
    });

    it('rejects SUPER_ADMIN with clear guidance to switch to Super Admin tab (resolving reported bug)', () => {
      const admin = { role: 'SUPER_ADMIN' };
      const res = validateLoginRoleSection('manager', admin);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'admin');
      assert.match(res.error || '', /Super Admin/i);
      assert.match(res.error || '', /switch to the Super Admin tab/i);
    });

    it('rejects unrecognized roles in manager portal', () => {
      const unknown = { role: 'WAREHOUSE_STAFF' };
      const res = validateLoginRoleSection('manager', unknown);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /not recognized/i);
    });
  });

  // =========================================================================
  // 3. ADMIN SECTION RULES ('admin')
  // =========================================================================
  describe('3. Admin Section Rules (Super Admin tab)', () => {
    it('allows SUPER_ADMIN to log in', () => {
      const admin = { role: 'SUPER_ADMIN' };
      const res = validateLoginRoleSection('admin', admin);
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('allows SUPER_ADMIN with lowercase role string (case-insensitivity)', () => {
      const res = validateLoginRoleSection('admin', { role: 'super_admin' });
      assert.equal(res.isValid, true);
    });

    it('rejects standard MANAGER with clear guidance to switch to Territory Manager tab', () => {
      const standardManager = { role: 'MANAGER', isSeller: false };
      const res = validateLoginRoleSection('admin', standardManager);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'manager');
      assert.match(res.error || '', /Territory Manager/i);
      assert.match(res.error || '', /switch to the Territory Manager tab/i);
    });

    it('rejects Dual-Role MANAGER (role: MANAGER, isSeller: true) with clear guidance', () => {
      const dualRoleManager = { role: 'MANAGER', isSeller: true };
      const res = validateLoginRoleSection('admin', dualRoleManager);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'manager');
      assert.match(res.error || '', /Territory Manager/i);
    });

    it('rejects SELLER with clear guidance to switch to Field Seller tab', () => {
      const seller = { role: 'SELLER' };
      const res = validateLoginRoleSection('admin', seller);
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'seller');
      assert.match(res.error || '', /Field Seller/i);
      assert.match(res.error || '', /switch to the Field Seller tab/i);
    });

    it('rejects unrecognized roles in admin portal', () => {
      const unknown = { role: 'CUSTOMER' };
      const res = validateLoginRoleSection('admin', unknown);
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /not recognized/i);
    });
  });

  // =========================================================================
  // 4. PRE-LOGIN IDENTIFIER INSPECTION & RESOLUTION
  // =========================================================================
  describe('4. Pre-login Identifier Inspection (checkIdentifierForRoleSection & resolveKnownUserRole)', () => {
    it('resolves known mock users accurately with resolveKnownUserRole', () => {
      // Admin
      const adminResolved = resolveKnownUserRole('admin@femmeflo.com');
      assert.ok(adminResolved);
      assert.equal(adminResolved.role, 'SUPER_ADMIN');
      assert.equal(adminResolved.section, 'admin');

      // Manager
      const managerResolved = resolveKnownUserRole('manager@femmeflo.com');
      assert.ok(managerResolved);
      assert.equal(managerResolved.role, 'MANAGER');
      assert.equal(managerResolved.section, 'manager');

      // Seller
      const sellerResolved = resolveKnownUserRole('seller@femmeflo.com');
      assert.ok(sellerResolved);
      assert.equal(sellerResolved.role, 'SELLER');
      assert.equal(sellerResolved.section, 'seller');
    });

    it('resolves phone numbers to their matching personas', () => {
      // 9876543230 is admin
      const adminByPhone = resolveKnownUserRole('+91 98765 43230');
      assert.ok(adminByPhone);
      assert.equal(adminByPhone.role, 'SUPER_ADMIN');

      // 9876543220 is manager
      const managerByPhone = resolveKnownUserRole('9876543220');
      assert.ok(managerByPhone);
      assert.equal(managerByPhone.role, 'MANAGER');

      // 9876543210 is seller
      const sellerByPhone = resolveKnownUserRole('+91-98765-43210');
      assert.ok(sellerByPhone);
      assert.equal(sellerByPhone.role, 'SELLER');
    });

    it('resolves dual-role manager heuristics from identifier names', () => {
      const dualByEmail = resolveKnownUserRole('dual.manager@femmeflo.com');
      assert.ok(dualByEmail);
      assert.equal(dualByEmail.role, 'MANAGER');
      assert.equal(dualByEmail.isSeller, true);

      const dualByCombo = resolveKnownUserRole('manager.seller@femmeflo.com');
      assert.ok(dualByCombo);
      assert.equal(dualByCombo.role, 'MANAGER');
      assert.equal(dualByCombo.isSeller, true);
    });

    it('resolves custom dynamic users passed to resolveKnownUserRole', () => {
      const customUsers = [
        { email: 'custom.dual@example.com', phone: '9998887771', role: 'MANAGER', isSeller: true },
        { email: 'custom.seller@example.com', phone: '9998887772', role: 'SELLER' },
        { email: 'custom.admin@example.com', phone: '9998887773', role: 'SUPER_ADMIN' },
      ];

      const resDual = resolveKnownUserRole('custom.dual@example.com', customUsers);
      assert.ok(resDual);
      assert.equal(resDual.role, 'MANAGER');
      assert.equal(resDual.isSeller, true);

      const resSeller = resolveKnownUserRole('9998887772', customUsers);
      assert.ok(resSeller);
      assert.equal(resSeller.role, 'SELLER');

      const resAdmin = resolveKnownUserRole('custom.admin@example.com', customUsers);
      assert.ok(resAdmin);
      assert.equal(resAdmin.role, 'SUPER_ADMIN');
    });

    it('returns null for unknown identifier in resolveKnownUserRole', () => {
      assert.equal(resolveKnownUserRole('unregistered.stranger@domain.com'), null);
      assert.equal(resolveKnownUserRole(''), null);
      assert.equal(resolveKnownUserRole('   '), null);
    });

    // --- Pre-login Section Validation (checkIdentifierForRoleSection) ---
    it("flags mismatch for 'admin@femmeflo.com' in manager tab with easy-to-understand message", () => {
      const res = checkIdentifierForRoleSection('manager', 'admin@femmeflo.com');
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'admin');
      assert.match(res.error || '', /Super Admin/i);
      assert.match(res.error || '', /switch to the Super Admin tab/i);
    });

    it("flags mismatch for 'seller@femmeflo.com' in manager tab", () => {
      const res = checkIdentifierForRoleSection('manager', 'seller@femmeflo.com');
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'seller');
      assert.match(res.error || '', /Field Seller/i);
      assert.match(res.error || '', /switch to the Field Seller tab/i);
    });

    it("flags mismatch for 'manager@femmeflo.com' in seller tab if not dual-role", () => {
      const res = checkIdentifierForRoleSection('seller', 'manager@femmeflo.com');
      assert.equal(res.isValid, false);
      assert.equal(res.recommendedSection, 'manager');
      assert.match(res.error || '', /Territory Manager/i);
      assert.match(res.error || '', /switch to the Territory Manager tab/i);
    });

    it("validates 'admin@femmeflo.com' in admin tab as valid", () => {
      const res = checkIdentifierForRoleSection('admin', 'admin@femmeflo.com');
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it("validates 'seller@femmeflo.com' in seller tab as valid", () => {
      const res = checkIdentifierForRoleSection('seller', 'seller@femmeflo.com');
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it("validates 'manager@femmeflo.com' in manager tab as valid", () => {
      const res = checkIdentifierForRoleSection('manager', 'manager@femmeflo.com');
      assert.equal(res.isValid, true);
      assert.equal(res.error, undefined);
    });

    it('allows dual-role manager in BOTH seller and manager tabs', () => {
      const resSellerTab = checkIdentifierForRoleSection('seller', 'dual.manager@femmeflo.com');
      assert.equal(resSellerTab.isValid, true);

      const resManagerTab = checkIdentifierForRoleSection('manager', 'dual.manager@femmeflo.com');
      assert.equal(resManagerTab.isValid, true);

      // But flags mismatch in admin tab
      const resAdminTab = checkIdentifierForRoleSection('admin', 'dual.manager@femmeflo.com');
      assert.equal(resAdminTab.isValid, false);
      assert.equal(resAdminTab.recommendedSection, 'manager');
    });

    it('returns isValid: true for empty or unknown identifiers to allow backend auth', () => {
      // Empty / whitespace
      assert.equal(checkIdentifierForRoleSection('seller', '').isValid, true);
      assert.equal(checkIdentifierForRoleSection('manager', '   ').isValid, true);

      // Unknown email / phone
      assert.equal(checkIdentifierForRoleSection('seller', 'unknown999@domain.org').isValid, true);
      assert.equal(checkIdentifierForRoleSection('manager', '9999999999').isValid, true);
      assert.equal(checkIdentifierForRoleSection('admin', 'nonexistent.officer@femmeflo.com').isValid, true);
    });
  });

  // =========================================================================
  // 5. ERROR MESSAGING VILLAGE-FRIENDLY & USABILITY VERIFICATION
  // =========================================================================
  describe('5. Error Messaging Usability (Plain, friendly, village-simple language)', () => {
    const errorScenarios: Array<{
      section: LoginRoleSection;
      user: { role: string; isSeller?: boolean };
      expectedTabMention: string;
      forbiddenJargon: string[];
    }> = [
      {
        section: 'manager',
        user: { role: 'SUPER_ADMIN' },
        expectedTabMention: 'Super Admin',
        forbiddenJargon: ['403', 'forbidden', 'unauthorized', 'rbac', 'jwt', 'exception', 'stack', 'null pointer'],
      },
      {
        section: 'seller',
        user: { role: 'SUPER_ADMIN' },
        expectedTabMention: 'Super Admin',
        forbiddenJargon: ['403', 'forbidden', 'unauthorized', 'rbac', 'jwt', 'exception', 'stack'],
      },
      {
        section: 'seller',
        user: { role: 'MANAGER', isSeller: false },
        expectedTabMention: 'Territory Manager',
        forbiddenJargon: ['403', 'forbidden', 'unauthorized', 'rbac', 'jwt', 'exception', 'stack'],
      },
      {
        section: 'manager',
        user: { role: 'SELLER' },
        expectedTabMention: 'Field Seller',
        forbiddenJargon: ['403', 'forbidden', 'unauthorized', 'rbac', 'jwt', 'exception', 'stack'],
      },
      {
        section: 'admin',
        user: { role: 'SELLER' },
        expectedTabMention: 'Field Seller',
        forbiddenJargon: ['403', 'forbidden', 'unauthorized', 'rbac', 'jwt', 'exception', 'stack'],
      },
      {
        section: 'admin',
        user: { role: 'MANAGER', isSeller: true },
        expectedTabMention: 'Territory Manager',
        forbiddenJargon: ['403', 'forbidden', 'unauthorized', 'rbac', 'jwt', 'exception', 'stack'],
      },
    ];

    for (const scenario of errorScenarios) {
      it(`provides actionable message for ${scenario.user.role} (isSeller: ${scenario.user.isSeller}) in ${scenario.section} section`, () => {
        const res = validateLoginRoleSection(scenario.section, scenario.user);
        assert.equal(res.isValid, false);
        assert.ok(res.error, 'Error message must exist');

        // Check clear guidance to the right tab
        assert.ok(
          res.error.toLowerCase().includes(scenario.expectedTabMention.toLowerCase()),
          `Error should mention "${scenario.expectedTabMention}", got: "${res.error}"`
        );
        assert.ok(
          res.error.toLowerCase().includes('switch to the') || res.error.toLowerCase().includes('tab above'),
          `Error should give clear switch instructions, got: "${res.error}"`
        );

        // Check for absence of technical developer jargon
        for (const jargon of scenario.forbiddenJargon) {
          assert.equal(
            res.error.toLowerCase().includes(jargon),
            false,
            `Error message should NOT contain technical jargon "${jargon}": "${res.error}"`
          );
        }
      });
    }
  });

  // =========================================================================
  // 6. EXHAUSTIVE ROLE x SECTION MATRIX VERIFICATION
  // =========================================================================
  describe('6. Exhaustive Role x Section Matrix Verification', () => {
    interface MatrixTestCase {
      section: LoginRoleSection;
      role: string;
      isSeller?: boolean;
      expectedValid: boolean;
      expectedRecommended?: LoginRoleSection;
    }

    const testMatrix: MatrixTestCase[] = [
      // Seller Portal Matrix
      { section: 'seller', role: 'SELLER', expectedValid: true },
      { section: 'seller', role: 'SELLER', isSeller: true, expectedValid: true },
      { section: 'seller', role: 'SELLER', isSeller: false, expectedValid: true },
      { section: 'seller', role: 'MANAGER', isSeller: true, expectedValid: true }, // Dual role
      { section: 'seller', role: 'MANAGER', isSeller: false, expectedValid: false, expectedRecommended: 'manager' },
      { section: 'seller', role: 'MANAGER', expectedValid: false, expectedRecommended: 'manager' },
      { section: 'seller', role: 'SUPER_ADMIN', expectedValid: false, expectedRecommended: 'admin' },

      // Manager Portal Matrix
      { section: 'manager', role: 'MANAGER', isSeller: false, expectedValid: true },
      { section: 'manager', role: 'MANAGER', isSeller: true, expectedValid: true }, // Dual role can access manager too
      { section: 'manager', role: 'MANAGER', expectedValid: true },
      { section: 'manager', role: 'SELLER', expectedValid: false, expectedRecommended: 'seller' },
      { section: 'manager', role: 'SELLER', isSeller: true, expectedValid: false, expectedRecommended: 'seller' },
      { section: 'manager', role: 'SUPER_ADMIN', expectedValid: false, expectedRecommended: 'admin' },

      // Admin Portal Matrix
      { section: 'admin', role: 'SUPER_ADMIN', expectedValid: true },
      { section: 'admin', role: 'MANAGER', isSeller: false, expectedValid: false, expectedRecommended: 'manager' },
      { section: 'admin', role: 'MANAGER', isSeller: true, expectedValid: false, expectedRecommended: 'manager' },
      { section: 'admin', role: 'MANAGER', expectedValid: false, expectedRecommended: 'manager' },
      { section: 'admin', role: 'SELLER', expectedValid: false, expectedRecommended: 'seller' },
      { section: 'admin', role: 'SELLER', isSeller: true, expectedValid: false, expectedRecommended: 'seller' },
    ];

    for (const testCase of testMatrix) {
      const desc = `${testCase.role} (isSeller: ${testCase.isSeller}) in '${testCase.section}' section -> ${
        testCase.expectedValid ? 'ALLOWED' : `REJECTED (recommend: ${testCase.expectedRecommended})`
      }`;

      it(desc, () => {
        const res = validateLoginRoleSection(testCase.section, {
          role: testCase.role,
          isSeller: testCase.isSeller,
        });
        assert.equal(res.isValid, testCase.expectedValid);
        if (!testCase.expectedValid && testCase.expectedRecommended) {
          assert.equal(res.recommendedSection, testCase.expectedRecommended);
        }
      });
    }
  });

  // =========================================================================
  // 7. REAL MOCK USERS AUDIT ACROSS ALL SECTIONS
  // =========================================================================
  describe('7. Real Mock Database Users Cross-Section Validation', () => {
    it('validates MOCK_USERS.admin across all 3 portals', () => {
      const admin = MOCK_USERS.admin;
      assert.equal(validateLoginRoleSection('admin', admin).isValid, true);
      assert.equal(validateLoginRoleSection('manager', admin).isValid, false);
      assert.equal(validateLoginRoleSection('seller', admin).isValid, false);
    });

    it('validates MOCK_USERS.manager across all 3 portals', () => {
      const manager = MOCK_USERS.manager;
      assert.equal(validateLoginRoleSection('admin', manager).isValid, false);
      assert.equal(validateLoginRoleSection('manager', manager).isValid, true);
      // MOCK_USERS.manager is not dual role (isSeller is not true)
      assert.equal(validateLoginRoleSection('seller', manager).isValid, false);
    });

    it('validates MOCK_USERS.seller across all 3 portals', () => {
      const seller = MOCK_USERS.seller;
      assert.equal(validateLoginRoleSection('admin', seller).isValid, false);
      assert.equal(validateLoginRoleSection('manager', seller).isValid, false);
      assert.equal(validateLoginRoleSection('seller', seller).isValid, true);
    });

    it('validates all MOCK_ALL_MANAGERS can access manager portal', () => {
      for (const mgr of MOCK_ALL_MANAGERS) {
        const res = validateLoginRoleSection('manager', mgr);
        assert.equal(res.isValid, true, `Manager ${mgr.id} should access manager portal`);
        assert.equal(validateLoginRoleSection('admin', mgr).isValid, false);
      }
    });

    it('validates all MOCK_ALL_SELLERS can access seller portal', () => {
      for (const s of MOCK_ALL_SELLERS) {
        const res = validateLoginRoleSection('seller', s);
        assert.equal(res.isValid, true, `Seller ${s.id} should access seller portal`);
        assert.equal(validateLoginRoleSection('admin', s).isValid, false);
        assert.equal(validateLoginRoleSection('manager', s).isValid, false);
      }
    });
  });

  // =========================================================================
  // 8. POST-LOGIN SESSION PROTECTION SIMULATION
  // =========================================================================
  describe('8. Post-login Session Protection Simulation', () => {
    it('simulates login flow: blocks admin credentials returned on manager tab and triggers session eviction', () => {
      // User entered admin credentials while on 'manager' tab
      const selectedSection: LoginRoleSection = 'manager';
      const authenticatedUser = {
        id: 'usr_admin_01',
        name: 'Anita Mehta',
        role: 'SUPER_ADMIN',
        email: 'admin@femmeflo.com',
      };

      const validation = validateLoginRoleSection(selectedSection, authenticatedUser);
      assert.equal(validation.isValid, false);
      assert.equal(validation.recommendedSection, 'admin');

      // In login.tsx, when validation.isValid === false, it triggers logout()
      let sessionEvicted = false;
      if (!validation.isValid) {
        sessionEvicted = true;
      }
      assert.equal(sessionEvicted, true);
    });

    it('simulates login flow: blocks seller credentials returned on manager tab and triggers session eviction', () => {
      const selectedSection: LoginRoleSection = 'manager';
      const authenticatedUser = {
        id: 'usr_seller_01',
        name: 'Pooja Sharma',
        role: 'SELLER',
        email: 'seller@femmeflo.com',
      };

      const validation = validateLoginRoleSection(selectedSection, authenticatedUser);
      assert.equal(validation.isValid, false);
      assert.equal(validation.recommendedSection, 'seller');
    });

    it('simulates login flow: permits dual-role manager on seller tab and determines correct route', () => {
      const selectedSection: LoginRoleSection = 'seller';
      const dualRoleUser = {
        id: 'usr_dual_01',
        name: 'Kavita Dual',
        role: 'MANAGER',
        isSeller: true,
        email: 'kavita.dual@femmeflo.com',
      };

      const validation = validateLoginRoleSection(selectedSection, dualRoleUser);
      assert.equal(validation.isValid, true);

      // Verify routing decision for dual-role manager
      function determinePostLoginRoute(section: LoginRoleSection, user: { role: string; isSeller?: boolean }): string {
        if (user.role === 'SUPER_ADMIN') return '/(admin)';
        if (user.role === 'MANAGER') {
          if (user.isSeller && section === 'seller') return '/(seller)';
          return '/(manager)';
        }
        if (user.role === 'SELLER') return '/(seller)';
        return '/(auth)/login';
      }

      assert.equal(determinePostLoginRoute('seller', dualRoleUser), '/(seller)');
      assert.equal(determinePostLoginRoute('manager', dualRoleUser), '/(manager)');
    });
  });
});
