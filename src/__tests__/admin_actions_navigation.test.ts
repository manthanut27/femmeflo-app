import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Admin Actions Navigation & History Retention Suite', () => {
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

  it('verifies actions/index.tsx propagates { from: "actions" } for all 13 modules', () => {
    const actionsPath = path.join(rootDir, 'src', 'app', '(admin)', 'actions', 'index.tsx');
    assert.ok(fs.existsSync(actionsPath), 'Administrative Actions hub must exist');
    const content = fs.readFileSync(actionsPath, 'utf-8');

    assert.match(
      content,
      /navigate\(tabName,\s*\{\s*from:\s*'actions'\s*\}\)/,
      'Actions hub must navigate to direct tabs with { from: "actions" }'
    );

    assert.match(
      content,
      /params:\s*\{\s*from:\s*'actions'\s*\}/,
      'Actions hub must push secondary and dynamic routes with { from: "actions" }'
    );

    // Verify all 13 operational modules have direct tab mappings
    const expectedDirectRoutes = [
      '/(admin)/reports',
      '/(admin)/approvals',
      '/(admin)/products',
      '/(admin)/invoices',
      '/(admin)/sales',
      '/(admin)/incentives',
      '/(admin)/shifts',
      '/(admin)/permissions',
      '/(admin)/customers',
      '/(admin)/users',
      '/(admin)/categories',
      '/(admin)/settings',
      '/(admin)/inventory',
    ];

    for (const route of expectedDirectRoutes) {
      assert.ok(
        content.includes(`'${route}':`),
        `Actions hub directTabs must contain route mapping for ${route}`
      );
    }
  });

  it('verifies all dedicated administrative action screens safely return to actions/index', () => {
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
    ];

    for (const screen of dedicatedScreens) {
      const fullPath = path.join(rootDir, screen.path);
      assert.ok(fs.existsSync(fullPath), `${screen.name} screen file must exist at ${screen.path}`);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Verify actions/index navigation in handleBack
      assert.match(
        content,
        /navigate\(['"]actions\/index['"]\)/,
        `${screen.name} handleBack must navigate to 'actions/index'`
      );

      // Verify hardware back listener registration
      assert.match(
        content,
        /BackHandler\.addEventListener\(['"]hardwareBackPress['"]/,
        `${screen.name} must register hardwareBackPress BackHandler listener`
      );
    }
  });

  it('verifies primary bottom tabs check params.from === "actions" and return to actions hub when entered from actions', () => {
    const bottomTabScreens = [
      { name: 'Approvals', path: 'src/app/(admin)/approvals/index.tsx' },
      { name: 'Reports', path: 'src/app/(admin)/reports/index.tsx' },
      { name: 'Users', path: 'src/app/(admin)/users/index.tsx' },
      { name: 'Settings', path: 'src/app/(admin)/settings/index.tsx' },
      { name: 'HQ Stock', path: 'src/app/(admin)/inventory/index.tsx' },
    ];

    for (const screen of bottomTabScreens) {
      const fullPath = path.join(rootDir, screen.path);
      assert.ok(fs.existsSync(fullPath), `${screen.name} screen file must exist at ${screen.path}`);
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Verify origin check
      assert.match(
        content,
        /from\s*===\s*['"]actions['"]/,
        `${screen.name} must check if navigated from actions hub`
      );

      // Verify back destination to actions/index
      assert.match(
        content,
        /navigate\(['"]actions\/index['"]\)/,
        `${screen.name} must return to 'actions/index' when from actions`
      );
    }
  });
});
