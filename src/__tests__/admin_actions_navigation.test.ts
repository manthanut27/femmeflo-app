import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Three-Panel Navigation, Admin Home & Bottom Navbar Suite', () => {
  const rootDir = process.cwd();

  const readFile = (relPath: string) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  it('verifies useDashboardBackHandler registers focus-scoped hardware back directly to target route', () => {
    const hook = readFile('src/hooks/useDashboardBackHandler.ts');
    assert.match(hook, /useFocusEffect/, 'Must scope hardwareBackPress listener with useFocusEffect');
    assert.match(
      hook,
      /BackHandler\.addEventListener\(['"]hardwareBackPress['"]/,
      'Must intercept hardware back press'
    );
    assert.match(
      hook,
      /router\.replace\(targetRoute as any\)/,
      'Must replace directly to target panel dashboard route'
    );
  });

  it('verifies Admin Home page contains FemmeFlo, Sale Management System, Masako logo at bottom, and Sidebar', () => {
    const home = readFile('src/app/(admin)/home/index.tsx');
    assert.match(home, /FemmeFlo/, 'Admin Home must render FemmeFlo branding');
    assert.match(home, /Sale Management System/, 'Admin Home must render Sale Management System subtitle');
    assert.match(home, /masako-logo\.jpeg/, 'Admin Home must render Masako logo');
    assert.match(home, /Masako Enterprises/, 'Admin Home must display Masako Enterprises attribution');
    assert.match(home, /<MobileNavigationDrawer/, 'Admin Home must provide sidebar navigation drawer');
    assert.doesNotMatch(home, /Quick Workspace Access|Quick Actions/i, 'Admin Home must not render quick actions grid');

    const drawer = readFile('src/components/common/MobileNavigationDrawer.tsx');
    assert.match(
      drawer,
      /title:\s*'Home'[\s\S]*route:\s*'\/\(admin\)\/home'/,
      'Admin sidebar must include Home route'
    );
    assert.match(
      drawer,
      /title:\s*'Dashboard'[\s\S]*route:\s*'\/\(admin\)'/,
      'Admin sidebar must include Dashboard route'
    );
  });

  it('verifies Admin bottom navbar shows only Home, Dashboard, Approvals, Inventory, and Sales', () => {
    const layout = readFile('src/app/(admin)/_layout.tsx');

    assert.match(
      layout,
      /<Tabs[\s\S]*?backBehavior="history"/,
      'Admin layout must keep Tabs backBehavior="history"'
    );
    assert.ok(!layout.includes('href: null'), 'Admin tabs must not use href: null');

    const visibleTabs = [
      /name="home\/index"[\s\S]*?title:\s*'Home'/,
      /name="index"[\s\S]*?title:\s*'Dashboard'/,
      /name="approvals\/index"[\s\S]*?title:\s*'Approvals'/,
      /name="inventory"[\s\S]*?isSmallMobile \? 'Stock' : 'Inventory'/,
      /name="sales\/index"[\s\S]*?title:\s*'Sales'/,
    ];
    for (const pattern of visibleTabs) {
      assert.match(layout, pattern, `Expected visible admin tab matching ${pattern}`);
    }

    assert.match(
      layout,
      /name="users\/index"[\s\S]*?tabBarButton:\s*\(\)\s*=>\s*null/,
      'Users screen must be hidden from Admin visible bottom navbar'
    );
  });

  it('verifies only Home and Dashboard screens across all three panels contain MobileNavigationDrawer', () => {
    const allowedDrawerScreens = [
      'src/app/(admin)/home/index.tsx',
      'src/app/(admin)/index.tsx',
      'src/app/(manager)/index.tsx',
      'src/app/(seller)/index.tsx',
    ];
    for (const rel of allowedDrawerScreens) {
      assert.match(
        readFile(rel),
        /<MobileNavigationDrawer/,
        `${rel} must render MobileNavigationDrawer`
      );
    }

    const nonDrawerScreens = [
      'src/app/(admin)/approvals/index.tsx',
      'src/app/(admin)/inventory/index.tsx',
      'src/app/(admin)/sales/index.tsx',
      'src/app/(admin)/users/index.tsx',
      'src/app/(admin)/reports/index.tsx',
      'src/app/(admin)/settings/index.tsx',
      'src/app/(admin)/shifts/index.tsx',
      'src/app/(admin)/invoices/index.tsx',
      'src/app/(admin)/incentives/index.tsx',
      'src/app/(admin)/customers/index.tsx',
      'src/app/(admin)/products/index.tsx',
      'src/app/(admin)/categories/index.tsx',
      'src/app/(admin)/permissions/index.tsx',
      'src/app/(manager)/sales/index.tsx',
      'src/app/(manager)/sellers/index.tsx',
      'src/app/(manager)/customers/index.tsx',
      'src/app/(manager)/inventory/index.tsx',
      'src/app/(manager)/incentives/index.tsx',
      'src/app/(manager)/shifts/index.tsx',
      'src/app/(manager)/profile/index.tsx',
      'src/app/(seller)/attendance/index.tsx',
      'src/app/(seller)/sales/index.tsx',
      'src/app/(seller)/customers/index.tsx',
      'src/app/(seller)/inventory/index.tsx',
      'src/app/(seller)/incentives/index.tsx',
      'src/app/(seller)/profile/index.tsx',
    ];

    for (const rel of nonDrawerScreens) {
      const code = readFile(rel);
      assert.doesNotMatch(
        code,
        /<MobileNavigationDrawer/,
        `${rel} must not contain MobileNavigationDrawer`
      );
      assert.doesNotMatch(
        code,
        /\bshowMenu\b/,
        `${rel} must not show sidebar hamburger menu`
      );
      assert.match(
        code,
        /useDashboardBackHandler\(/,
        `${rel} must use useDashboardBackHandler for direct return to dashboard`
      );
      assert.match(
        code,
        /onBack=\{handleBack\}|onPress=\{handleBack\}/,
        `${rel} header back action must call handleBack`
      );
    }
  });

  it('verifies nested Admin stock sub-screens keep router.back() and BackHandler for parent return', () => {
    const nestedSubScreens = [
      'src/app/(admin)/inventory/transfer.tsx',
      'src/app/(admin)/inventory/new.tsx',
    ];
    for (const rel of nestedSubScreens) {
      const code = readFile(rel);
      assert.match(code, /router\.back\(\)/, `${rel} must use router.back()`);
      assert.match(
        code,
        /BackHandler\.addEventListener\(['"]hardwareBackPress['"]/,
        `${rel} must register hardwareBackPress listener`
      );
    }
  });
});
