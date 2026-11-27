import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Manager & Seller Strict Portal Isolation', () => {
  const appRoot = process.cwd();

  it('persists sessionRole per login portal in authApi, tokenStorage, and AuthContext', () => {
    const authApiSrc = fs.readFileSync(path.join(appRoot, 'src/api/auth.ts'), 'utf8');
    assert.ok(authApiSrc.includes('roleHint: payload.roleHint'));

    const clientSrc = fs.readFileSync(path.join(appRoot, 'src/api/client.ts'), 'utf8');
    assert.ok(clientSrc.includes('SESSION_ROLE_KEY'));
    assert.ok(clientSrc.includes('async getSessionRole'));
    assert.ok(clientSrc.includes('async setSessionRole'));

    const authContextSrc = fs.readFileSync(path.join(appRoot, 'src/context/AuthContext.tsx'), 'utf8');
    assert.ok(authContextSrc.includes('export function resolveActivePortalRole'));
    assert.ok(authContextSrc.includes('sessionRole ?? user?.sessionRole ?? user?.role'));
  });

  it('keeps MobileNavigationDrawer labels, links, and duty banner strictly bound to sessionRole', () => {
    const drawerSrc = fs.readFileSync(
      path.join(appRoot, 'src/components/common/MobileNavigationDrawer.tsx'),
      'utf8'
    );
    assert.ok(drawerSrc.includes('const effectiveRole = sessionRole ?? user?.role'));
    assert.ok(drawerSrc.includes("isManager ? 'Area Manager' : 'Field Seller'"));
    assert.ok(drawerSrc.includes("isManager ? '/(manager)/attendance' : '/(seller)/attendance'"));
    assert.ok(!drawerSrc.includes("user?.role === 'MANAGER'"));
  });

  it('prevents cross-panel jumping and keeps manager work inside (manager) routes', () => {
    const managerLayoutSrc = fs.readFileSync(path.join(appRoot, 'src/app/(manager)/_layout.tsx'), 'utf8');
    assert.ok(managerLayoutSrc.includes('name="attendance/index"'));
    assert.ok(managerLayoutSrc.includes('name="sales"'));
    assert.ok(managerLayoutSrc.includes("effectiveRole === 'MANAGER' || effectiveRole === 'SUPER_ADMIN'"));

    const sellerLayoutSrc = fs.readFileSync(path.join(appRoot, 'src/app/(seller)/_layout.tsx'), 'utf8');
    assert.ok(sellerLayoutSrc.includes("const isAllowedSeller = effectiveRole === 'SELLER'"));

    const managerDashboardSrc = fs.readFileSync(path.join(appRoot, 'src/app/(manager)/index.tsx'), 'utf8');
    assert.ok(!managerDashboardSrc.includes('/(seller)/'));
    assert.ok(managerDashboardSrc.includes('/(manager)/attendance'));
    assert.ok(managerDashboardSrc.includes('/(manager)/sales/new'));

    const managerShiftsSrc = fs.readFileSync(path.join(appRoot, 'src/app/(manager)/shifts/index.tsx'), 'utf8');
    assert.ok(!managerShiftsSrc.includes('/(seller)/'));
    assert.ok(managerShiftsSrc.includes('/(manager)/attendance'));

    const managerSalesSrc = fs.readFileSync(path.join(appRoot, 'src/app/(manager)/sales/index.tsx'), 'utf8');
    assert.ok(!managerSalesSrc.includes('/(seller)/'));
    assert.ok(managerSalesSrc.includes('/(manager)/sales/new'));
    assert.ok(managerSalesSrc.includes('/(manager)/sales/${item.id}'));

    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/(manager)/attendance/index.tsx')));
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/(manager)/sales/_layout.tsx')));
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/(manager)/sales/new.tsx')));
    assert.ok(fs.existsSync(path.join(appRoot, 'src/app/(manager)/sales/[id].tsx')));
  });

  it('removes manual cross-panel switcher cards from dashboards and profiles', () => {
    const sellerHome = fs.readFileSync(path.join(appRoot, 'src/app/(seller)/index.tsx'), 'utf8');
    assert.ok(!sellerHome.includes('Back to Manager Screen'));

    const sellerProfile = fs.readFileSync(path.join(appRoot, 'src/app/(seller)/profile/index.tsx'), 'utf8');
    assert.ok(!sellerProfile.includes('Return to Manager Hub'));

    const managerProfile = fs.readFileSync(path.join(appRoot, 'src/app/(manager)/profile/index.tsx'), 'utf8');
    assert.ok(!managerProfile.includes('Switch to Field Sales Mode'));
  });
});
