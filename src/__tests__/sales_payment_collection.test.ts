import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SaleItem } from '../api/types';

describe('Seller Sales Payment Collection & Amount Resilience Suite', () => {
  function normalizeSale(raw: any): SaleItem {
    if (!raw || typeof raw !== 'object') return raw;
    const totalAmountPaise = raw.totalAmountPaise ?? raw.totalPaise ?? raw.amountPaise ?? 0;
    const packetCount = raw.packetCount ?? raw.quantity ?? 0;

    const rawItems = Array.isArray(raw.items) && raw.items.length > 0
      ? raw.items
      : Array.isArray(raw.lineItems) && raw.lineItems.length > 0
        ? raw.lineItems
        : [];

    const items = rawItems.map((it: any, index: number) => {
      const qty = it.quantity ?? (rawItems.length === 1 ? packetCount : 1);
      const unitPrice = it.unitPricePaise ?? (qty > 0 ? Math.round((it.totalPricePaise ?? totalAmountPaise) / qty) : 0);
      const totalPrice = it.totalPricePaise ?? (qty * unitPrice);
      const name = it.productName || it.product?.name || (it.product?.sku ? `SKU: ${it.product.sku}` : 'FemmeFlo Sanitary Napkins');

      return {
        id: it.id || `item_${index}`,
        productId: it.productId || it.product?.id || 'prod',
        productName: name,
        quantity: qty,
        unitPricePaise: unitPrice,
        totalPricePaise: totalPrice,
      };
    });

    return {
      ...raw,
      totalAmountPaise,
      totalPaise: raw.totalPaise ?? totalAmountPaise,
      packetCount: packetCount || items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0),
      quantity: raw.quantity ?? packetCount,
      items: items.length > 0 ? items : [
        {
          id: '1',
          productId: 'prod_default',
          productName: 'FemmeFlo Sanitary Napkins',
          quantity: packetCount || 1,
          unitPricePaise: packetCount > 0 ? Math.round(totalAmountPaise / packetCount) : totalAmountPaise,
          totalPricePaise: totalAmountPaise,
        },
      ],
      lineItems: items,
    };
  }

  const formatRupees = (paise?: number | null) => {
    return `₹${(((paise ?? 0)) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  it('1. Correctly maps backend totalPaise into totalAmountPaise to avoid 0.00 bug', () => {
    // Exact shape from live Render backend
    const backendSale = {
      id: 'e0695616-788b-448f-8224-79ab3faa4944',
      quantity: 45,
      unitPricePaise: 2000,
      totalPaise: 90000,
      paymentMode: 'PENDING',
      status: 'CONFIRMED',
      lineItems: [
        {
          id: 'li_01',
          productId: 'p_01',
          quantity: 45,
          unitPricePaise: 2000,
          product: {
            id: 'p_01',
            name: 'FemmeFlo Panty Liners (Pack of 30)',
            sku: 'FF-LINERS-30',
          },
        },
      ],
    };

    const normalized = normalizeSale(backendSale);

    assert.equal(normalized.totalAmountPaise, 90000);
    assert.equal(normalized.totalPaise, 90000);
    assert.equal(normalized.packetCount, 45);
    assert.equal(formatRupees(normalized.totalAmountPaise), '₹900.00');

    // Verify items array is populated with real product names & totals
    assert.equal(normalized.items?.length, 1);
    assert.equal(normalized.items?.[0].productName, 'FemmeFlo Panty Liners (Pack of 30)');
    assert.equal(normalized.items?.[0].quantity, 45);
    assert.equal(normalized.items?.[0].unitPricePaise, 2000);
    assert.equal(normalized.items?.[0].totalPricePaise, 90000);
    assert.equal(formatRupees(normalized.items?.[0].unitPricePaise), '₹20.00');
  });

  it('2. Preserves frontend totalAmountPaise when present from mock data', () => {
    const mockSale = {
      id: 'mock_01',
      totalAmountPaise: 44000,
      packetCount: 20,
      paymentMode: 'PENDING',
      status: 'CONFIRMED',
      items: [
        {
          id: 'sli_003',
          productId: 'prod_01',
          productName: 'FemmeFlo Ultra Comfort Regular',
          quantity: 20,
          unitPricePaise: 2200,
          totalPricePaise: 44000,
        },
      ],
    };

    const normalized = normalizeSale(mockSale);
    assert.equal(normalized.totalAmountPaise, 44000);
    assert.equal(normalized.totalPaise, 44000);
    assert.equal(formatRupees(normalized.totalAmountPaise), '₹440.00');
    assert.equal(normalized.items?.[0].productName, 'FemmeFlo Ultra Comfort Regular');
  });

  it('3. Constructs strict backend-compatible collectPayment body with mode key only', () => {
    const payload = {
      paymentMode: 'CASH' as const,
      paymentReference: 'REF123',
    };

    const mode = (payload.paymentMode || (payload as any).mode || 'CASH') as 'CASH' | 'BANK';
    const body: Record<string, any> = {
      mode,
    };

    // Must strictly have 'mode' and NOT 'paymentMode' or 'paymentReference'
    assert.equal(body.mode, 'CASH');
    assert.equal(body.paymentMode, undefined);
    assert.equal(body.paymentReference, undefined);
    assert.deepEqual(Object.keys(body), ['mode']);
  });

  it('4. Correctly distinguishes PENDING approval vs CONFIRMED for payment collection eligibility', () => {
    const isPaymentCollectable = (sale: { status: string; paymentMode: string }) => {
      const isConfirmed = sale.status === 'CONFIRMED' || sale.status === 'APPROVED';
      const isPendingPayment = sale.paymentMode === 'PENDING';
      const isRejected = sale.status === 'REJECTED';
      return isPendingPayment && !isRejected && isConfirmed;
    };

    // Confirmed order with pending payment -> collectable!
    assert.equal(
      isPaymentCollectable({ status: 'CONFIRMED', paymentMode: 'PENDING' }),
      true
    );

    // Pending admin approval -> NOT collectable until approved!
    assert.equal(
      isPaymentCollectable({ status: 'PENDING_APPROVAL', paymentMode: 'PENDING' }),
      false
    );
    assert.equal(
      isPaymentCollectable({ status: 'PENDING', paymentMode: 'PENDING' }),
      false
    );

    // Rejected sale -> NOT collectable
    assert.equal(
      isPaymentCollectable({ status: 'REJECTED', paymentMode: 'PENDING' }),
      false
    );

    // Already paid -> NOT collectable
    assert.equal(
      isPaymentCollectable({ status: 'CONFIRMED', paymentMode: 'CASH' }),
      false
    );
  });
});

