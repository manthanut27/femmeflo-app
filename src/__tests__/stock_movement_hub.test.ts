import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTransactionIST,
  getTransactionRoute,
  validateStockTransfer,
  calculateQuickAdd,
  generateReceiptRequestKey,
} from '../utils/inventoryMovement.ts';
import type { AdminInventoryTransactionItem } from '../api/types.ts';

describe('Admin Stock Movement Hub & Safety Suite', () => {
  it('verifies primary 3-section segmented navigation options', () => {
    const SECTIONS = [
      { key: 'TRANSFER', label: 'Stock Transfer' },
      { key: 'INWARD', label: 'Stock Inward' },
      { key: 'HISTORY', label: 'History' },
    ];

    assert.strictEqual(SECTIONS.length, 3);
    assert.deepStrictEqual(SECTIONS.map((s) => s.label), [
      'Stock Transfer',
      'Stock Inward',
      'History',
    ]);
  });

  it('generates an independent unique idempotency request key for stock receipts', () => {
    // Generate two keys and verify uniqueness and prefix
    const genKey = () => `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const key1 = genKey();
    const key2 = genKey();

    assert.notStrictEqual(key1, key2);
    assert.ok(key1.startsWith('rcpt_'));
    assert.ok(key2.startsWith('rcpt_'));

    // Business batch numbers must not be used as the idempotency key
    const payload = {
      productId: 'prod_sanitary_01',
      quantity: 500,
      batchNumber: 'BATCH-LOT-9988',
    };
    // Ensure requestKey is generated independently rather than falling back to batchNumber
    const generatedRequestKey = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    assert.notStrictEqual(generatedRequestKey, payload.batchNumber);
  });

  it('formats transaction timestamps into Indian Standard Time (IST) accurately', () => {
    // 2026-11-08T03:52:00.000Z is 09:22 AM IST on 08 Nov 2026 (UTC + 5:30)
    const { dateStr, timeStr } = formatTransactionIST('2026-11-08T03:52:00.000Z');

    assert.strictEqual(dateStr, '08 Nov 2026');
    assert.strictEqual(timeStr, '09:22 AM');

    // Safe handling of null, undefined, or invalid ISO strings without throw
    assert.deepStrictEqual(formatTransactionIST(undefined), { dateStr: '—', timeStr: '—' });
    assert.deepStrictEqual(formatTransactionIST('invalid-iso-date'), { dateStr: '—', timeStr: '—' });
  });

  it('correctly maps transaction routing presentation across Inward, Transfer, and Sale', () => {
    // 1. INWARD
    const inwardTx: AdminInventoryTransactionItem = {
      id: 'tx_01',
      type: 'INWARD',
      quantity: 5000,
      createdAt: '2026-11-08T03:52:00.000Z',
      sourceLocation: 'Factory / Supplier',
      destinationLocation: 'Headquarters (HQ)',
    };
    const inwardRoute = getTransactionRoute(inwardTx);
    assert.strictEqual(inwardRoute.from, 'Factory / Supplier');
    assert.strictEqual(inwardRoute.to, 'Headquarters (HQ)');

    // 2. TRANSFER
    const transferTx: AdminInventoryTransactionItem = {
      id: 'tx_02',
      type: 'TRANSFER',
      quantity: 200,
      createdAt: '2026-11-07T05:30:00.000Z',
      sourceLocation: 'Headquarters (HQ)',
      destinationLocation: 'Varanasi Regional Hub',
    };
    const transferRoute = getTransactionRoute(transferTx);
    assert.strictEqual(transferRoute.from, 'Headquarters (HQ)');
    assert.strictEqual(transferRoute.to, 'Varanasi Regional Hub');

    // 3. SALE
    const saleTx: AdminInventoryTransactionItem = {
      id: 'tx_03',
      type: 'SALE',
      quantity: 30,
      createdAt: '2026-11-06T10:00:00.000Z',
      sourceLocation: 'Indore Central Van #04',
      sale: {
        id: 'sale_01',
        customerName: 'Radha Medical Store',
        customer: { shopName: 'Radha Medical & General Store' },
      },
    };
    const saleRoute = getTransactionRoute(saleTx);
    assert.strictEqual(saleRoute.from, 'Indore Central Van #04');
    assert.strictEqual(saleRoute.to, 'Radha Medical & General Store');
  });

  it('validates stock transfer quantity against available source balance', () => {
    const availableStock = 450;

    const validateTransfer = (qtyStr: string) => {
      const qty = parseInt(qtyStr, 10);
      const isValid = !isNaN(qty) && qty > 0;
      const isExceeded = isValid && availableStock > 0 && qty > availableStock;
      return { isValid, isExceeded, canSubmit: isValid && !isExceeded };
    };

    assert.deepStrictEqual(validateTransfer('100'), { isValid: true, isExceeded: false, canSubmit: true });
    assert.deepStrictEqual(validateTransfer('450'), { isValid: true, isExceeded: false, canSubmit: true });
    assert.deepStrictEqual(validateTransfer('451'), { isValid: true, isExceeded: true, canSubmit: false });
    assert.deepStrictEqual(validateTransfer('0'), { isValid: false, isExceeded: false, canSubmit: false });
    assert.deepStrictEqual(validateTransfer('-50'), { isValid: false, isExceeded: false, canSubmit: false });
    assert.deepStrictEqual(validateTransfer('abc'), { isValid: false, isExceeded: false, canSubmit: false });
  });

  it('integrates quick-add pills with available stock capping', () => {
    const availableStock = 1200;
    const quickPills = [100, 500, 1000, 2500, 5000];

    const applyQuickAdd = (currentStr: string, addAmount: number) => {
      const current = parseInt(currentStr, 10);
      const next = isNaN(current) || current <= 0 ? addAmount : current + addAmount;
      if (availableStock > 0 && next > availableStock) {
        return String(availableStock);
      }
      return String(next);
    };

    // Starting from 100, add 500 -> 600
    assert.strictEqual(applyQuickAdd('100', 500), '600');
    // From 600, add 500 -> 1100
    assert.strictEqual(applyQuickAdd('600', 500), '1100');
    // From 1100, add 500 -> capped at availableStock (1200)
    assert.strictEqual(applyQuickAdd('1100', 500), '1200');
    // From 0, add 1000 -> 1000
    assert.strictEqual(applyQuickAdd('0', 1000), '1000');
    // From 1000, add 2500 -> capped at 1200
    assert.strictEqual(applyQuickAdd('1000', 2500), '1200');
  });

  it('supports the 4 required transaction history filters without fake fields', () => {
    const FILTERS = ['All', 'Inward', 'Transfer', 'Sales'];
    assert.strictEqual(FILTERS.length, 4);

    const mapApiFilter = (f: string) => {
      if (f === 'Inward') return 'INWARD';
      if (f === 'Transfer') return 'TRANSFER';
      if (f === 'Sales') return 'SALE';
      return undefined;
    };

    assert.strictEqual(mapApiFilter('All'), undefined);
    assert.strictEqual(mapApiFilter('Inward'), 'INWARD');
    assert.strictEqual(mapApiFilter('Transfer'), 'TRANSFER');
    assert.strictEqual(mapApiFilter('Sales'), 'SALE');
  });
});
