import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PendingApprovalItem } from '../api/types';

describe('Admin Approvals Display & Data Integrity Suite', () => {
  function normalizeApprovalItem(raw: any): PendingApprovalItem {
    const totalPaise = Number(raw.totalPaise ?? raw.totalAmountPaise ?? 0);
    const totalAmountPaise = Number(raw.totalAmountPaise ?? raw.totalPaise ?? totalPaise);
    const quantity = Number(raw.quantity ?? raw.packetCount ?? 0);
    const packetCount = Number(raw.packetCount ?? raw.quantity ?? quantity);
    const unitPricePaise = Number(
      raw.unitPricePaise ?? (quantity > 0 ? Math.round(totalPaise / quantity) : 0)
    );
    const lineItems = Array.isArray(raw.lineItems)
      ? raw.lineItems
      : Array.isArray(raw.items)
      ? raw.items
      : [];

    const saleNumber =
      raw.saleNumber ||
      (raw.id && typeof raw.id === 'string'
        ? `#${raw.id.slice(0, 8).toUpperCase()}`
        : undefined);

    const isResubmitted = Boolean(
      raw.isResubmitted ||
      raw.resubmitForApproval ||
      raw.resubmittedAt ||
      (typeof raw.customerFeedback === 'string' && (raw.customerFeedback.includes('Price Revised') || raw.customerFeedback.includes('Resubmitted'))) ||
      (typeof raw.approvalReason === 'string' && raw.approvalReason.includes('revised'))
    );

    return {
      ...raw,
      id: String(raw.id || ''),
      saleNumber,
      totalPaise,
      totalAmountPaise,
      quantity,
      packetCount,
      unitPricePaise,
      lineItems,
      items: lineItems,
      requestedUnitPricePaise: raw.requestedUnitPricePaise ?? unitPricePaise,
      minimumPricePaise: raw.minimumPricePaise ?? 2500,
      isResubmitted,
      resubmitForApproval: isResubmitted,
    };
  }

  it('detects resubmitted sales and sets isResubmitted and resubmitForApproval', () => {
    const rawResubmittedSale = {
      id: 'resub-123',
      totalPaise: 44000,
      quantity: 20,
      unitPricePaise: 2200,
      customerFeedback: '[Price Revised: ₹22.00] Customer agreed to discount price',
      status: 'PENDING_APPROVAL',
      createdAt: '2026-11-01T10:00:00Z',
    };

    const normalized = normalizeApprovalItem(rawResubmittedSale);
    assert.equal(normalized.isResubmitted, true);
    assert.equal(normalized.resubmitForApproval, true);
  });

  it('correctly sorts resubmitted orders at the top of the queue', () => {
    const items = [
      normalizeApprovalItem({ id: 'old-first-time', createdAt: '2026-11-01T10:00:00Z', isResubmitted: false }),
      normalizeApprovalItem({ id: 'new-resubmitted', createdAt: '2026-10-25T10:00:00Z', isResubmitted: true, resubmittedAt: '2026-11-05T12:00:00Z' }),
      normalizeApprovalItem({ id: 'recent-first-time', createdAt: '2026-11-04T10:00:00Z', isResubmitted: false }),
    ];

    items.sort((a, b) => {
      if (a.isResubmitted && !b.isResubmitted) return -1;
      if (!a.isResubmitted && b.isResubmitted) return 1;
      const timeA = new Date(a.resubmittedAt || a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.resubmittedAt || b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    assert.equal(items[0].id, 'new-resubmitted');
    assert.equal(items[1].id, 'recent-first-time');
    assert.equal(items[2].id, 'old-first-time');
  });

  it('normalizes raw backend sale with totalPaise and quantity into approval item', () => {
    const rawBackendSale = {
      id: 'c0326e10-449e-4a65-8b9a-4d2d477e6822',
      customerId: 'cust-1',
      sellerId: 'seller-1',
      quantity: 50,
      unitPricePaise: 2000,
      totalPaise: 100000,
      paymentMode: 'CASH',
      status: 'PENDING_APPROVAL',
      customer: {
        id: 'cust-1',
        shopName: 'Sharma General Store',
        contactName: 'Ramesh Sharma',
        phone: '9876543210',
      },
      seller: {
        id: 'seller-1',
        name: 'Pooja Verma',
      },
      lineItems: [
        {
          id: 'item-1',
          productId: 'prod-pad-01',
          quantity: 50,
          unitPricePaise: 2000,
          totalPaise: 100000,
          product: {
            id: 'prod-pad-01',
            name: 'FemmeFlo Regular Pads (10 pkts)',
            sku: 'FF-PAD-REG',
          },
        },
      ],
      createdAt: '2026-11-04T12:00:00.000Z',
    };

    const normalized = normalizeApprovalItem(rawBackendSale);

    // Value checks
    assert.equal(normalized.totalPaise, 100000);
    assert.equal(normalized.totalAmountPaise, 100000);

    // Quantity checks
    assert.equal(normalized.quantity, 50);
    assert.equal(normalized.packetCount, 50);

    // Unit price check
    assert.equal(normalized.unitPricePaise, 2000);

    // Order number generation
    assert.equal(normalized.saleNumber, '#C0326E10');

    // Products / line items check
    assert.ok(Array.isArray(normalized.lineItems));
    assert.equal(normalized.lineItems.length, 1);
    assert.equal(normalized.lineItems[0].product?.name, 'FemmeFlo Regular Pads (10 pkts)');
    assert.equal(normalized.lineItems[0].product?.sku, 'FF-PAD-REG');
    assert.equal(normalized.lineItems[0].quantity, 50);
    assert.equal(normalized.lineItems[0].unitPricePaise, 2000);
  });

  it('handles empty lineItems or missing totalPaise with fallback safely', () => {
    const rawSparseSale = {
      id: 'd9876543-1111-2222-3333-444455556666',
      customerId: 'cust-2',
      sellerId: 'seller-2',
      totalAmountPaise: 50000,
      packetCount: 25,
      status: 'PENDING_APPROVAL',
      customer: {
        id: 'cust-2',
        shopName: 'Gupta Medical Store',
      },
    };

    const normalized = normalizeApprovalItem(rawSparseSale);

    assert.equal(normalized.totalPaise, 50000);
    assert.equal(normalized.totalAmountPaise, 50000);
    assert.equal(normalized.quantity, 25);
    assert.equal(normalized.packetCount, 25);
    assert.equal(normalized.unitPricePaise, 2000); // 50000 / 25
    assert.equal(normalized.saleNumber, '#D9876543');
    assert.deepEqual(normalized.lineItems, []);
  });

  it('correctly computes effective unit price and threshold comparisons without zero division or NaN', () => {
    function computeEffectivePrice(totalPaise: number, quantity: number): number {
      return quantity > 0 ? Math.round(totalPaise / quantity) : 0;
    }

    assert.equal(computeEffectivePrice(100000, 50), 2000);
    assert.equal(computeEffectivePrice(0, 50), 0);
    assert.equal(computeEffectivePrice(100000, 0), 0);
  });

  it('correctly sums KPI total flagged paise and total packets across approvals', () => {
    const approvals = [
      normalizeApprovalItem({
        id: '1',
        totalPaise: 100000,
        quantity: 50,
      }),
      normalizeApprovalItem({
        id: '2',
        totalPaise: 40000,
        quantity: 20,
      }),
    ];

    const totalPaise = approvals.reduce((sum, a) => sum + Number(a.totalPaise ?? a.totalAmountPaise ?? 0), 0);
    const totalPackets = approvals.reduce((sum, a) => sum + Number(a.quantity ?? a.packetCount ?? 0), 0);

    assert.equal(totalPaise, 140000);
    assert.equal(totalPackets, 70);
  });
});
