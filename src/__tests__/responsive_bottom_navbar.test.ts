import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Responsive Bottom Navbar & Tab Naming Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  it('verifies (admin)/_layout.tsx uses modern Dashboard naming, responsive insets, and TabBarIcon', () => {
    const code = readFile('src/app/(admin)/_layout.tsx');

    // Naming checks
    assert.match(code, /title:\s*'Dashboard'/, 'Admin tab must be renamed from Executive to Dashboard');
    assert.doesNotMatch(code, /title:\s*'Executive'/, 'Executive naming must not be present');
    assert.match(code, /title:\s*'Reports'/, 'Admin must have Reports tab');
    assert.match(code, /title:\s*'Approvals'/, 'Admin must have Approvals tab');
    assert.match(code, /isSmallMobile \? 'Stock' : 'Inventory'/, 'Admin inventory tab must be responsive for small screens');
    assert.match(code, /title:\s*'Users'/, 'Admin must have Users tab');
    assert.match(code, /title:\s*'Settings'/, 'Admin must have Settings tab');

    // Responsiveness & Insets
    assert.match(code, /useSafeAreaInsets/, 'Admin layout must use dynamic safe area insets');
    assert.match(code, /useResponsiveLayout/, 'Admin layout must use responsive layout hook');
    assert.match(code, /TabBarIcon/, 'Admin layout must use polished TabBarIcon');
    assert.match(code, /backBehavior="history"/, 'Admin tabs must retain history back behavior');
  });

  it('verifies (manager)/_layout.tsx uses responsive insets, history navigation, and TabBarIcon', () => {
    const code = readFile('src/app/(manager)/_layout.tsx');

    // Naming checks
    assert.match(code, /title:\s*'Dashboard'/, 'Manager must have Dashboard tab');
    assert.match(code, /title:\s*'Team'/, 'Manager must have Team tab');
    assert.match(code, /title:\s*'Stores'/, 'Manager must have Stores tab');
    assert.match(code, /title:\s*'Sales'/, 'Manager must have Sales tab');
    assert.match(code, /title:\s*'Profile'/, 'Manager must have Profile tab');

    // Responsiveness & Insets
    assert.match(code, /useSafeAreaInsets/, 'Manager layout must use dynamic safe area insets');
    assert.match(code, /useResponsiveLayout/, 'Manager layout must use responsive layout hook');
    assert.match(code, /TabBarIcon/, 'Manager layout must use polished TabBarIcon');
    assert.match(code, /backBehavior="history"/, 'Manager tabs must retain history back behavior');
  });

  it('verifies (seller)/_layout.tsx renames Duty Shift to Shift and implements responsive insets', () => {
    const code = readFile('src/app/(seller)/_layout.tsx');

    // Naming checks
    assert.match(code, /title:\s*'Home'/, 'Seller must have Home tab');
    assert.match(code, /title:\s*'Shift'/, 'Seller tab must be renamed from Duty Shift to Shift for responsive fit');
    assert.doesNotMatch(code, /title:\s*'Duty Shift'/, 'Duty Shift naming must not be present');
    assert.match(code, /title:\s*'Sales'/, 'Seller must have Sales tab');
    assert.match(code, /title:\s*'Customers'/, 'Seller must have Customers tab');
    assert.match(code, /title:\s*'Profile'/, 'Seller must have Profile tab');

    // Responsiveness & Insets
    assert.match(code, /useSafeAreaInsets/, 'Seller layout must use dynamic safe area insets');
    assert.match(code, /useResponsiveLayout/, 'Seller layout must use responsive layout hook');
    assert.match(code, /TabBarIcon/, 'Seller layout must use polished TabBarIcon');
    assert.match(code, /backBehavior="history"/, 'Seller tabs must retain history back behavior');
  });

  it('verifies TabBarIcon component implements active highlight pill and badge support', () => {
    const code = readFile('src/components/ui/TabBarIcon.tsx');
    assert.match(code, /export function TabBarIcon/, 'TabBarIcon component must be exported');
    assert.match(code, /pillBg/, 'TabBarIcon must support active highlight background');
    assert.match(code, /badge/, 'TabBarIcon must support optional badge indicator');
  });
});
