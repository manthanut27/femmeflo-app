import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Seller Sales & Reports Stats Card Redirection Suite', () => {
  it('filters uncollected pending sales from general sales history', () => {
    const rawSales = [
      { id: 's1', paymentMode: 'CASH', status: 'CONFIRMED', totalAmountPaise: 5000 },
      { id: 's2', paymentMode: 'PENDING', status: 'CONFIRMED', totalAmountPaise: 3500 },
      { id: 's3', paymentMode: 'BANK', status: 'CONFIRMED', totalAmountPaise: 7000 },
      { id: 's4', paymentMode: 'PENDING', status: 'REJECTED', totalAmountPaise: 2000 },
      { id: 's5', paymentMode: 'PENDING', status: 'PENDING_APPROVAL', totalAmountPaise: 4500 },
    ];

    const pendingUncollected = rawSales.filter(
      (s) => s.paymentMode === 'PENDING' && s.status !== 'REJECTED'
    );

    assert.equal(pendingUncollected.length, 2);
    assert.deepEqual(pendingUncollected.map((s) => s.id), ['s2', 's5']);
  });

  it('correctly calculates total pending uncollected paise and affected stores count', () => {
    const pendingSales = [
      { id: 's1', customerId: 'c1', totalAmountPaise: 3500, packetCount: 10 },
      { id: 's2', customerId: 'c2', totalAmountPaise: 4500, packetCount: 15 },
      { id: 's3', customerId: 'c1', totalAmountPaise: 2000, packetCount: 5 },
    ];

    const totalPaise = pendingSales.reduce((sum, s) => sum + s.totalAmountPaise, 0);
    const totalPackets = pendingSales.reduce((sum, s) => sum + s.packetCount, 0);
    const uniqueShops = new Set(pendingSales.map((s) => s.customerId)).size;

    assert.equal(totalPaise, 10000);
    assert.equal(totalPackets, 30);
    assert.equal(uniqueShops, 2);
  });

  it('ensures sales/index.tsx binds the PENDING stats card to /(seller)/sales/pending', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(process.cwd(), 'src/app/(seller)/sales/index.tsx');
    const content = await fs.readFile(filePath, 'utf-8');

    // Ensure the PENDING stats box has onPress redirecting to /(seller)/sales/pending
    assert.match(content, /router\.push\(['"]\/\(seller\)\/sales\/pending['"]/);
    // Ensure the All Uncollected link in header navigates to pending
    assert.match(content, /All Uncollected/);
    // Ensure UNCOLLECTED_PAYMENT / PAYMENT_PENDING filter exists
    assert.match(content, /PAYMENT_PENDING/);
  });

  it('ensures sales/_layout.tsx registers the pending route', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const layoutPath = path.resolve(process.cwd(), 'src/app/(seller)/sales/_layout.tsx');
    const content = await fs.readFile(layoutPath, 'utf-8');

    assert.match(content, /name=["']pending["']/);
  });
});
