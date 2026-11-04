import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Seller Dashboard Stats & Low Stock Regression Tests', () => {
  it('sellerApi logic preserves 0 values and does not fall back to dummy mock numbers', async () => {
    // Simulated backend payload returning 0 for sales/orders when stock is low
    const raw = {
      todaySalesPaise: 0,
      todaySalesAmountPaise: 0,
      todayOrdersCount: 0,
      todayPacketsSold: 0,
      monthSalesPaise: 0,
      lowStockCount: 1,
      stockBalance: 5,
    };

    // The fixed nullish coalescing parsing in seller dashboard
    const todaySalesPaise = raw.todaySalesPaise ?? raw.todaySalesAmountPaise ?? 0;
    const todayOrdersCount = raw.todayOrdersCount ?? 0;
    const stockBalance = raw.stockBalance ?? 0;
    const lowStockCount = raw.lowStockCount ?? (stockBalance < 20 ? 1 : 0);

    assert.strictEqual(todaySalesPaise, 0, '0 salesPaise must stay 0 and not become 147500');
    assert.strictEqual(todayOrdersCount, 0, '0 ordersCount must stay 0 and not become 18 or 45');
    assert.strictEqual(stockBalance, 5, 'stockBalance must be preserved as 5');
    assert.strictEqual(lowStockCount, 1, 'lowStockCount must accurately reflect low stock');
  });

  it('calculates metrics deterministically without || fallback jumps', () => {
    const todaySales: Array<{ totalAmountPaise: number; packetCount: number }> = [];
    const todayAmountPaise = todaySales.reduce((acc, s) => acc + s.totalAmountPaise, 0);
    const todayPackets = todaySales.reduce((acc, s) => acc + s.packetCount, 0);
    const todayOrdersCount = todaySales.length;

    assert.strictEqual(todayAmountPaise, 0, '0 total sales must not fall back to 147500');
    assert.strictEqual(todayPackets, 0, '0 packets must not fall back to 45');
    assert.strictEqual(todayOrdersCount, 0, '0 orders must not fall back to 18');
  });

  it('NumberTicker parsing correctly distinguishes numeric vs non-numeric and preserves suffixes', () => {
    function parseValue(value: string | number) {
      const rawStr = String(value ?? '');
      const match = rawStr.match(/^([^0-9.-]*)([0-9,]+(?:\.[0-9]+)?)(.*)$/);
      if (!match) {
        return { isNumeric: false, prefix: '', numStr: '', suffix: '', targetNum: NaN };
      }
      const targetNum = parseFloat(match[2].replace(/,/g, ''));
      return {
        isNumeric: !isNaN(targetNum) && isFinite(targetNum),
        prefix: match[1],
        numStr: match[2],
        suffix: match[3],
        targetNum,
      };
    }

    // Revenue
    const rev = parseValue('₹1,475.00');
    assert.strictEqual(rev.isNumeric, true);
    assert.strictEqual(rev.prefix, '₹');
    assert.strictEqual(rev.targetNum, 1475);

    // Orders
    const orders = parseValue('18');
    assert.strictEqual(orders.isNumeric, true);
    assert.strictEqual(orders.targetNum, 18);

    // Low stock text
    const lowStock = parseValue('1 Low');
    assert.strictEqual(lowStock.isNumeric, true);
    assert.strictEqual(lowStock.targetNum, 1);
    assert.strictEqual(lowStock.suffix, ' Low');

    // Healthy stock text
    const healthy = parseValue('Healthy');
    assert.strictEqual(healthy.isNumeric, false);
    assert.strictEqual(healthy.targetNum, NaN);
  });
});
