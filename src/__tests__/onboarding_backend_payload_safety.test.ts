import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  ALL_BACKEND_PERMISSIONS,
  sanitizeBackendPermissions,
  hasPermission,
} from '../utils/permissions.ts';

describe('Onboarding & Backend Payload Safety Suite', () => {
  describe('1. Backend Permission Enum Compliance', () => {
    it('ensures sanitizeBackendPermissions outputs strictly valid backend canonical permissions', () => {
      const uiPermissions = [
        'view_sellers',
        'onboard_sellers',
        'view_customers',
        'onboard_customers',
        'monitor_stock',
      ];

      const sanitized = sanitizeBackendPermissions(uiPermissions);
      const backendSet = new Set<string>(ALL_BACKEND_PERMISSIONS);

      // Verify that every single permission in the output exists in ALL_BACKEND_PERMISSIONS
      for (const perm of sanitized) {
        assert.ok(
          backendSet.has(perm),
          `Permission "${perm}" is not recognized by the backend enum`
        );
      }

      // Verify that invalid backend enum values are stripped
      assert.equal(sanitized.includes('view_sellers'), false, 'view_sellers must be filtered out');
      assert.equal(sanitized.includes('onboard_sellers'), false, 'onboard_sellers must be filtered out');
      assert.equal(sanitized.includes('monitor_stock'), false, 'monitor_stock must be filtered out');

      // Verify mapped canonical permissions are present
      assert.ok(sanitized.includes('manage_sellers'), 'manage_sellers should be granted');
      assert.ok(sanitized.includes('SELLER_READ'), 'SELLER_READ should be granted');
      assert.ok(sanitized.includes('SELLER_CREATE'), 'SELLER_CREATE should be granted');
      assert.ok(sanitized.includes('view_customers'), 'view_customers should be granted');
      assert.ok(sanitized.includes('CUSTOMER_READ'), 'CUSTOMER_READ should be granted');
      assert.ok(sanitized.includes('onboard_customers'), 'onboard_customers should be granted');
      assert.ok(sanitized.includes('CUSTOMER_CREATE'), 'CUSTOMER_CREATE should be granted');
      assert.ok(sanitized.includes('view_inventory'), 'view_inventory should be granted');
      assert.ok(sanitized.includes('INVENTORY_READ'), 'INVENTORY_READ should be granted');
    });

    it('handles empty or invalid inputs gracefully', () => {
      assert.deepEqual(sanitizeBackendPermissions([]), []);
      assert.deepEqual(sanitizeBackendPermissions(null as any), []);
      assert.deepEqual(sanitizeBackendPermissions(undefined as any), []);
      assert.deepEqual(sanitizeBackendPermissions(['unknown_key_xyz', 'random_key']), []);
    });

    it('preserves existing authorized backend permissions without modification', () => {
      const existing = ['transfer_inventory', 'approve_sales', 'view_reports', 'manage_permissions'];
      const sanitized = sanitizeBackendPermissions(existing);
      assert.ok(sanitized.includes('transfer_inventory'));
      assert.ok(sanitized.includes('approve_sales'));
      assert.ok(sanitized.includes('view_reports'));
      assert.ok(sanitized.includes('manage_permissions'));
    });

    it('ensures frontend hasPermission still grants access with sanitized backend permissions', () => {
      const user = {
        id: 'usr_mgr_test',
        name: 'Territory Manager',
        email: 'manager@test.com',
        role: 'MANAGER' as const,
        active: true,
        permissions: sanitizeBackendPermissions([
          'view_sellers',
          'onboard_sellers',
          'view_customers',
          'onboard_customers',
          'monitor_stock',
        ]),
      };

      // Frontend helpers check UI shorthand keys via aliases
      assert.equal(hasPermission(user, 'view_sellers'), true, 'Should have view_sellers access');
      assert.equal(hasPermission(user, 'onboard_sellers'), true, 'Should have onboard_sellers access');
      assert.equal(hasPermission(user, 'manage_sellers'), true, 'Should have manage_sellers access');
      assert.equal(hasPermission(user, 'view_customers'), true, 'Should have view_customers access');
      assert.equal(hasPermission(user, 'onboard_customers'), true, 'Should have onboard_customers access');
      assert.equal(hasPermission(user, 'monitor_stock'), true, 'Should have monitor_stock access');
      assert.equal(hasPermission(user, 'view_inventory'), true, 'Should have view_inventory access');
    });
  });

  describe('2. Request Body Key Scrubbing (No Unrecognized Keys)', () => {
    it('verifies admin.ts createManager does not include aadhaarNumber, drivingLicenseNumber, or qualification in body', () => {
      const adminPath = path.resolve(process.cwd(), 'src/api/admin.ts');
      const content = fs.readFileSync(adminPath, 'utf8');

      // Find createManager implementation
      const createManagerMatch = content.match(/async createManager\([\s\S]*?body: JSON\.stringify\(body\)/);
      assert.ok(createManagerMatch, 'createManager method should exist in admin.ts');
      const methodBody = createManagerMatch[0];

      assert.doesNotMatch(
        methodBody,
        /body\.aadhaarNumber\s*=/,
        'createManager body must NOT contain body.aadhaarNumber'
      );
      assert.doesNotMatch(
        methodBody,
        /body\.drivingLicenseNumber\s*=/,
        'createManager body must NOT contain body.drivingLicenseNumber'
      );
      assert.doesNotMatch(
        methodBody,
        /body\.qualification\s*=/,
        'createManager body must NOT contain body.qualification'
      );
      assert.match(
        methodBody,
        /sanitizeBackendPermissions/,
        'createManager must sanitize permissions before sending'
      );
    });

    it('verifies admin.ts createSeller does not include aadhaarNumber, drivingLicenseNumber, or qualification in body', () => {
      const adminPath = path.resolve(process.cwd(), 'src/api/admin.ts');
      const content = fs.readFileSync(adminPath, 'utf8');

      const createSellerMatch = content.match(/async createSeller\([\s\S]*?body: JSON\.stringify\(body\)/);
      assert.ok(createSellerMatch, 'createSeller method should exist in admin.ts');
      const methodBody = createSellerMatch[0];

      assert.doesNotMatch(
        methodBody,
        /body\.aadhaarNumber\s*=/,
        'createSeller body must NOT contain body.aadhaarNumber'
      );
      assert.doesNotMatch(
        methodBody,
        /body\.drivingLicenseNumber\s*=/,
        'createSeller body must NOT contain body.drivingLicenseNumber'
      );
      assert.doesNotMatch(
        methodBody,
        /body\.qualification\s*=/,
        'createSeller body must NOT contain body.qualification'
      );
    });

    it('verifies manager.ts createSeller does not include aadhaarNumber, drivingLicenseNumber, or qualification in body', () => {
      const managerPath = path.resolve(process.cwd(), 'src/api/manager.ts');
      const content = fs.readFileSync(managerPath, 'utf8');

      const createSellerMatch = content.match(/async createSeller\([\s\S]*?body: JSON\.stringify\(body\)/);
      assert.ok(createSellerMatch, 'createSeller method should exist in manager.ts');
      const methodBody = createSellerMatch[0];

      assert.doesNotMatch(
        methodBody,
        /body\.aadhaarNumber\s*=/,
        'manager createSeller body must NOT contain body.aadhaarNumber'
      );
      assert.doesNotMatch(
        methodBody,
        /body\.drivingLicenseNumber\s*=/,
        'manager createSeller body must NOT contain body.drivingLicenseNumber'
      );
      assert.doesNotMatch(
        methodBody,
        /body\.qualification\s*=/,
        'manager createSeller body must NOT contain body.qualification'
      );
    });
  });
});
