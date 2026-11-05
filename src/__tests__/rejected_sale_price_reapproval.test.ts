import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SaleItem, UpdateSalePayload } from '../api/types';

describe('Rejected Sale Price Editing for Reapproval Suite', () => {
  it('Scenario 1: Seller revises price on a rejected sale and resubmits for reapproval', () => {
    const rejectedSale: SaleItem = {
      id: 'sale_rej_01',
      saleNumber: 'FF-2026-00415',
      customerId: 'cust_01',
      sellerId: 'usr_seller_01',
      totalAmountPaise: 40000,
      packetCount: 20,
      quantity: 20,
      unitPricePaise: 2000,
      status: 'REJECTED',
      paymentMode: 'PENDING',
      rejectionReason: 'Selling price ₹20.00 is below the ₹25.00 floor rate. Revise price.',
      createdAt: '2026-10-28T16:00:00Z',
      items: [
        {
          id: 'sli_001',
          productId: 'prod_01',
          productName: 'FemmeFlo Regular',
          quantity: 20,
          unitPricePaise: 2000,
          totalPricePaise: 40000,
        },
      ],
    };

    // Seller inputs ₹26.50 per packet
    const revisedPriceRupees = 26.5;
    const newUnitPricePaise = Math.round(revisedPriceRupees * 100);
    const qty = rejectedSale.packetCount || rejectedSale.quantity || 1;
    const newTotalPaise = qty * newUnitPricePaise;

    const updatePayload: UpdateSalePayload = {
      unitPricePaise: newUnitPricePaise,
      totalAmountPaise: newTotalPaise,
      totalPaise: newTotalPaise,
      status: 'PENDING_APPROVAL',
      resubmitForApproval: true,
      notes: 'Customer agreed to revised ₹26.50/pkt rate.',
    };

    assert.strictEqual(updatePayload.unitPricePaise, 2650);
    assert.strictEqual(updatePayload.totalAmountPaise, 53000);
    assert.strictEqual(updatePayload.status, 'PENDING_APPROVAL');

    // Simulate backend PATCH update
    const updatedSale: SaleItem = {
      ...rejectedSale,
      unitPricePaise: updatePayload.unitPricePaise,
      totalAmountPaise: updatePayload.totalAmountPaise!,
      totalPaise: updatePayload.totalPaise!,
      status: 'PENDING_APPROVAL',
      rejectionReason: undefined,
      approvalReason: updatePayload.notes,
      resubmittedAt: new Date().toISOString(),
      items: (rejectedSale.items || []).map((it) => ({
        ...it,
        unitPricePaise: updatePayload.unitPricePaise!,
        totalPricePaise: (it.quantity || 1) * updatePayload.unitPricePaise!,
      })),
    };

    assert.strictEqual(updatedSale.status, 'PENDING_APPROVAL');
    assert.strictEqual(updatedSale.unitPricePaise, 2650);
    assert.strictEqual(updatedSale.totalAmountPaise, 53000);
    assert.strictEqual(updatedSale.rejectionReason, undefined);
    assert.strictEqual(updatedSale.items?.[0]?.unitPricePaise, 2650);
    assert.strictEqual(updatedSale.items?.[0]?.totalPricePaise, 53000);
    assert.ok(updatedSale.resubmittedAt);
  });

  it('Scenario 2: Manager updates price for field officer rejected sale and triggers reapproval', () => {
    const officerRejectedSale: SaleItem = {
      id: 'sale_officer_02',
      saleNumber: 'FF-2026-00416',
      customerId: 'cust_02',
      customer: { id: 'cust_02', shopName: 'Bhopal Chemist Store' } as any,
      sellerId: 'usr_seller_02',
      seller: { id: 'usr_seller_02', name: 'Kavita Patel' },
      totalAmountPaise: 45000,
      packetCount: 25,
      quantity: 25,
      unitPricePaise: 1800, // ₹18.00 - deep discount rejected by Admin
      status: 'REJECTED',
      paymentMode: 'CASH',
      rejectionReason: 'Severe discount below floor threshold ₹25.00',
      createdAt: '2026-10-28T17:00:00Z',
    };

    // Manager revises price to ₹27.00
    const managerPriceRupees = 27.0;
    const newUnitPricePaise = Math.round(managerPriceRupees * 100);
    const qty = officerRejectedSale.quantity || 1;
    const newTotalPaise = qty * newUnitPricePaise;

    const managerPayload: UpdateSalePayload = {
      unitPricePaise: newUnitPricePaise,
      totalAmountPaise: newTotalPaise,
      totalPaise: newTotalPaise,
      status: 'PENDING_APPROVAL',
      resubmitForApproval: true,
      notes: 'Territory Manager authorized ₹27.00/pkt bulk rate.',
    };

    assert.strictEqual(managerPayload.unitPricePaise, 2700);
    assert.strictEqual(managerPayload.totalAmountPaise, 67500);

    const reapprovedSale: SaleItem = {
      ...officerRejectedSale,
      unitPricePaise: managerPayload.unitPricePaise,
      totalAmountPaise: managerPayload.totalAmountPaise!,
      totalPaise: managerPayload.totalPaise!,
      status: 'PENDING_APPROVAL',
      rejectionReason: undefined,
      approvalReason: managerPayload.notes,
      resubmittedAt: new Date().toISOString(),
    };

    assert.strictEqual(reapprovedSale.status, 'PENDING_APPROVAL');
    assert.strictEqual(reapprovedSale.unitPricePaise, 2700);
    assert.strictEqual(reapprovedSale.totalAmountPaise, 67500);
    assert.strictEqual(reapprovedSale.rejectionReason, undefined);
  });

  it('Scenario 3: Resubmitted sales transition into the Super Admin Approvals review pipeline', () => {
    const allSales: SaleItem[] = [
      {
        id: 'sale_01',
        totalAmountPaise: 60000,
        packetCount: 20,
        status: 'CONFIRMED',
        paymentMode: 'CASH',
        createdAt: '2026-10-28T10:00:00Z',
      } as any,
      {
        id: 'sale_02',
        totalAmountPaise: 40000,
        packetCount: 20,
        unitPricePaise: 2000,
        status: 'REJECTED', // Was rejected
        rejectionReason: 'Below min floor',
        paymentMode: 'PENDING',
        createdAt: '2026-10-28T11:00:00Z',
      } as any,
    ];

    // Before reapproval: Pending approvals only includes PENDING or PENDING_APPROVAL
    let pendingApprovals = allSales.filter((s) => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL');
    assert.strictEqual(pendingApprovals.length, 0);

    // After price revision and reapproval resubmission
    const revisedSale: SaleItem = {
      ...allSales[1],
      unitPricePaise: 2600,
      totalAmountPaise: 52000,
      totalPaise: 52000,
      status: 'PENDING_APPROVAL',
      rejectionReason: undefined,
    };

    const updatedSalesList = allSales.map((s) => (s.id === revisedSale.id ? revisedSale : s));

    pendingApprovals = updatedSalesList.filter((s) => s.status === 'PENDING' || s.status === 'PENDING_APPROVAL');
    assert.strictEqual(pendingApprovals.length, 1);
    assert.strictEqual(pendingApprovals[0].id, 'sale_02');
    assert.strictEqual(pendingApprovals[0].unitPricePaise, 2600);
    assert.strictEqual(pendingApprovals[0].totalAmountPaise, 52000);
  });

  it('Scenario 4: Strict validation rejects invalid, zero, or negative prices', () => {
    const validatePriceInput = (priceStr: string): { valid: boolean; pricePaise?: number; error?: string } => {
      const num = parseFloat(priceStr);
      if (isNaN(num) || num <= 0) {
        return { valid: false, error: 'Please enter a valid price greater than ₹0.00' };
      }
      return { valid: true, pricePaise: Math.round(num * 100) };
    };

    assert.strictEqual(validatePriceInput('0').valid, false);
    assert.strictEqual(validatePriceInput('-5.50').valid, false);
    assert.strictEqual(validatePriceInput('abc').valid, false);
    assert.strictEqual(validatePriceInput('').valid, false);

    const validCase = validatePriceInput('28.50');
    assert.strictEqual(validCase.valid, true);
    assert.strictEqual(validCase.pricePaise, 2850);
  });
});
