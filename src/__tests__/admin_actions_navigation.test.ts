import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Admin Navigation & History Retention Suite', () => {
  const rootDir = process.cwd();

  it('verifies (admin)/_layout.tsx configures backBehavior="history" on Tabs', () => {
    const layoutPath = path.join(rootDir, 'src', 'app', '(admin)', '_layout.tsx');
    assert.ok(fs.existsSync(layoutPath), 'Admin _layout.tsx must exist');
    const content = fs.readFileSync(layoutPath, 'utf-8');

    assert.match(
      content,
      /<Tabs[\s\S]*?backBehavior="history"/,
      'Admin layout must set backBehavior="history" on Tabs to prevent jumping directly to initial route'
    );
  });

  it('verifies dedicated administrative screens use router.back() with /(admin) fallback', () => {
    const dedicatedScreens = [
      { name: 'Products', path: 'src/app/(admin)/products/index.tsx' },
      { name: 'Categories', path: 'src/app/(admin)/categories/index.tsx' },
      { name: 'Invoices', path: 'src/app/(admin)/invoices/index.tsx' },
      { name: 'Sales', path: 'src/app/(admin)/sales/index.tsx' },
      { name: 'Incentives', path: 'src/app/(admin)/incentives/index.tsx' },
      { name: 'Shifts', path: 'src/app/(admin)/shifts/index.tsx' },
      { name: 'Permissions', path: 'src/app/(admin)/permissions/index.tsx' },
      { name: 'Customers', path: 'src/app/(admin)/customers/index.tsx' },
      { name: 'Stock Movement', path: 'src/app/(admin)/inventory/transfer.tsx' },
      { name: 'Add Warehouse', path: 'src/app/(admin)/inventory/new.tsx' },
    ];

    for (const screen of dedicatedScreens) {
      const fullPath = path.join(rootDir, screen.path);
      assert.ok(fs.existsSync(fullPath), `${screen.name} screen file must exist at ${screen.path}`);
      const content = fs.readFileSync(fullPath, 'utf-8');

      assert.match(
        content,
        /router\.back\(\)/,
        `${screen.name} handleBack must use router.back()`
      );

      assert.match(
        content,
        /BackHandler\.addEventListener\(['"]hardwareBackPress['"]/,
        `${screen.name} must register hardwareBackPress BackHandler listener`
      );
    }
  });
});
