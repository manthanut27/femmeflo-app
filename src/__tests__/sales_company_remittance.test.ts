import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Sales Company Remittance & Bulk Complete Contracts', () => {
  const appRoot = process.cwd();
  const serverRoot = path.resolve(appRoot, '../femmeflo-server');

  it('supports COMPLETED SaleStatus in app types and Badge variant', () => {
    const typesSrc = fs.readFileSync(path.join(appRoot, 'src/api/types.ts'), 'utf8');
    assert.ok(typesSrc.includes("'COMPLETED'"), 'SaleStatus union must include COMPLETED');
    assert.ok(typesSrc.includes('paymentSentAt?: string | null'));
    assert.ok(typesSrc.includes('paymentReceivedRemark?: string | null'));

    const badgeSrc = fs.readFileSync(path.join(appRoot, 'src/components/ui/Badge.tsx'), 'utf8');
    assert.ok(badgeSrc.includes("case 'COMPLETED':"), 'Badge must style COMPLETED state');
  });

  it('provides seller markPaymentSent and admin receive/bulkComplete API helpers', () => {
    const sellerApiSrc = fs.readFileSync(path.join(appRoot, 'src/api/seller.ts'), 'utf8');
    assert.ok(sellerApiSrc.includes('async markPaymentSent'));
    assert.ok(sellerApiSrc.includes('/payment-sent'));

    const adminApiSrc = fs.readFileSync(path.join(appRoot, 'src/api/admin.ts'), 'utf8');
    assert.ok(adminApiSrc.includes('async receiveSalePayment'));
    assert.ok(adminApiSrc.includes('/receive-payment'));
    assert.ok(adminApiSrc.includes('async bulkCompleteSales'));
    assert.ok(adminApiSrc.includes('admin/sales/bulk-complete'));
  });

  it('exposes admin bulk select/complete UI and seller send payment modal', () => {
    const adminSalesSrc = fs.readFileSync(path.join(appRoot, 'src/app/(admin)/sales/index.tsx'), 'utf8');
    assert.ok(adminSalesSrc.includes('Select for Bulk Complete'));
    assert.ok(adminSalesSrc.includes('Amount Received & Complete'));
    assert.ok(adminSalesSrc.includes('RemittanceActionModal'));

    const sellerDetailSrc = fs.readFileSync(path.join(appRoot, 'src/app/(seller)/sales/[id].tsx'), 'utf8');
    assert.ok(sellerDetailSrc.includes('Mark Payment Sent to Company'));
    assert.ok(sellerDetailSrc.includes('Amount Received in FemmeFlo Account'));
  });

  it('keeps server settled status queries inclusive of both CONFIRMED and COMPLETED', () => {
    const serverIncentiveSrc = fs.readFileSync(
      path.join(serverRoot, 'src/services/seller/incentive.service.ts'),
      'utf8'
    );
    assert.ok(
      serverIncentiveSrc.includes('status: { in: ["CONFIRMED", "COMPLETED"] }'),
      'Seller incentives must include COMPLETED sales alongside CONFIRMED'
    );
  });
});
