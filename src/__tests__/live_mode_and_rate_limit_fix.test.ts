import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { groupSalesByDay } from '../utils/dateUtils.ts';

describe('Live Data Integrity, Packet Totals & Rate-Limit Protection Suite', () => {
  const rootDir = process.cwd();
  const readSource = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf-8');

  it('groupSalesByDay sums packetCount and lineItems when quantity field is absent', () => {
    const groups = groupSalesByDay([
      {
        id: 's1',
        packetCount: 20,
        totalAmountPaise: 60000,
        paymentMode: 'CASH',
        status: 'CONFIRMED',
        createdAt: '2026-10-28T10:10:00Z',
        seller: { name: 'Test Seller' },
      } as any,
      {
        id: 's2',
        quantity: 25,
        totalPaise: 87500,
        paymentMode: 'BANK',
        status: 'CONFIRMED',
        createdAt: '2026-10-28T12:25:00Z',
        seller: { name: 'Test Seller' },
      } as any,
      {
        id: 's3',
        lineItems: [{ quantity: 10 }, { quantity: 5 }],
        totalPaise: 45000,
        paymentMode: 'CASH',
        status: 'CONFIRMED',
        createdAt: '2026-10-28T14:00:00Z',
        seller: { name: 'Test Seller' },
      } as any,
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].totalPackets, 60);
    assert.equal(groups[0].salesCount, 3);
    assert.equal(groups[0].totalPaise, 192500);
  });

  it('API client and resource modules never serve mock fallback data unless isMockMode() is true', () => {
    const clientCode = readSource('src/api/client.ts');
    const managerCode = readSource('src/api/manager.ts');
    const sellerCode = readSource('src/api/seller.ts');
    const adminCode = readSource('src/api/admin.ts');

    assert.ok(clientCode.includes('if (isMockMode())'), 'client.ts must gate mock fallback behind isMockMode()');
    assert.ok(clientCode.includes('cachedOnRateLimit'), 'client.ts must serve cached GET data on HTTP 429');
    assert.ok(managerCode.includes('if (isMockMode())'), 'manager.ts must gate mock fallback behind isMockMode()');
    assert.ok(sellerCode.includes('if (isMockMode())'), 'seller.ts must gate mock fallback behind isMockMode()');
    assert.ok(adminCode.includes('if (isMockMode())'), 'admin.ts must gate mock fallback behind isMockMode()');
  });

  it('realtime polling avoids tight 3s/6s/7s API storms that trigger server 429 lockouts', () => {
    const syncCode = readSource('src/services/realtimeSync.ts');
    const mgrSalesCode = readSource('src/app/(manager)/sales/index.tsx');
    const sellerSalesCode = readSource('src/app/(seller)/sales/index.tsx');

    assert.ok(syncCode.includes('10000'), 'realtimeSync poll interval must be >= 10s');
    assert.ok(!mgrSalesCode.includes('}, 7000)'), '(manager)/sales must not hammer 3 endpoints every 7s');
    assert.ok(!sellerSalesCode.includes('}, 7000)'), '(seller)/sales must not hammer server every 7s');
  });
});
