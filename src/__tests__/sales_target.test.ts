import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Employee Sales Targets & Progress Contracts', () => {
  const appRoot = process.cwd();
  const serverRoot = path.resolve(appRoot, '../femmeflo-server');

  it('defines TargetPeriod and user sales target fields in backend schema and idempotent DDL', () => {
    const schemaSrc = fs.readFileSync(path.join(serverRoot, 'prisma/schema.prisma'), 'utf8');
    assert.ok(schemaSrc.includes('enum TargetPeriod'));
    assert.ok(schemaSrc.includes('salesTargetPackets'));
    assert.ok(schemaSrc.includes('salesTargetPeriod'));
    assert.ok(schemaSrc.includes('targetBonusPaise'));

    const ddlSrc = fs.readFileSync(path.join(serverRoot, 'src/config/remittance-schema.ts'), 'utf8');
    assert.ok(ddlSrc.includes('salesTargetPackets'));
    assert.ok(ddlSrc.includes('targetBonusPaise'));
  });

  it('exposes PATCH /admin/incentives/users/:id/target and targetProgress across incentives services', () => {
    const routeSrc = fs.readFileSync(path.join(serverRoot, 'src/routes/admin/incentive.routes.ts'), 'utf8');
    assert.ok(routeSrc.includes('/users/:id/target'));

    const adminSvcSrc = fs.readFileSync(path.join(serverRoot, 'src/services/admin/incentive.service.ts'), 'utf8');
    assert.ok(adminSvcSrc.includes('updateUserTarget:'));
    assert.ok(adminSvcSrc.includes('targetProgress'));

    const sellerSvcSrc = fs.readFileSync(path.join(serverRoot, 'src/services/seller/incentive.service.ts'), 'utf8');
    assert.ok(sellerSvcSrc.includes('targetProgress'));

    const managerSvcSrc = fs.readFileSync(path.join(serverRoot, 'src/services/manager/incentive.service.ts'), 'utf8');
    assert.ok(managerSvcSrc.includes('targetProgress'));
  });

  it('wires TargetProgressSummary and adminApi.updateUserTarget on frontend', () => {
    const typesSrc = fs.readFileSync(path.join(appRoot, 'src/api/types.ts'), 'utf8');
    assert.ok(typesSrc.includes('export interface TargetProgressSummary'));
    assert.ok(typesSrc.includes('salesTargetPackets?: number | null'));

    const adminApiSrc = fs.readFileSync(path.join(appRoot, 'src/api/admin.ts'), 'utf8');
    assert.ok(adminApiSrc.includes('async updateUserTarget'));
    assert.ok(adminApiSrc.includes('admin/incentives/users/${userId}/target'));

    const sellerApiSrc = fs.readFileSync(path.join(appRoot, 'src/api/seller.ts'), 'utf8');
    assert.ok(sellerApiSrc.includes('targetProgress:'));
  });

  it('renders TargetProgressStrip and sales target controls cleanly inside existing screens without a separate page', () => {
    const stripSrc = fs.readFileSync(
      path.join(appRoot, 'src/components/incentives/TargetProgressStrip.tsx'),
      'utf8'
    );
    assert.ok(stripSrc.includes('export function TargetProgressStrip'));
    assert.ok(stripSrc.includes('Monthly Target'));
    assert.ok(stripSrc.includes('Daily Target'));

    const adminIncentivesSrc = fs.readFileSync(
      path.join(appRoot, 'src/app/(admin)/incentives/index.tsx'),
      'utf8'
    );
    assert.ok(adminIncentivesSrc.includes('Assign Sales Target'));
    assert.ok(adminIncentivesSrc.includes('Remove Target'));
    assert.ok(adminIncentivesSrc.includes('TargetProgressStrip'));

    const adminUsersSrc = fs.readFileSync(
      path.join(appRoot, 'src/app/(admin)/users/index.tsx'),
      'utf8'
    );
    assert.ok(adminUsersSrc.includes('Sales Target (Optional)'));
    assert.ok(adminUsersSrc.includes('salesTargetPackets'));

    const sellerIncentivesSrc = fs.readFileSync(
      path.join(appRoot, 'src/app/(seller)/incentives/index.tsx'),
      'utf8'
    );
    assert.ok(sellerIncentivesSrc.includes('<TargetProgressStrip'));

    const managerIncentivesSrc = fs.readFileSync(
      path.join(appRoot, 'src/app/(manager)/incentives/index.tsx'),
      'utf8'
    );
    assert.ok(managerIncentivesSrc.includes('<TargetProgressStrip'));
  });
});
