import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

describe('Incentive Default Rate, Dual-Role Visibility & In-App Tax Invoice PDF Suite', () => {
  const rootDir = process.cwd();
  const readSource = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf-8');

  it('defaults commission rate fallback to 100 paise (₹1.00) across API client and screens instead of 500/1500', () => {
    const sellerApiCode = readSource('src/api/seller.ts');
    const adminScreenCode = readSource('src/app/(admin)/incentives/index.tsx');
    const sellerScreenCode = readSource('src/app/(seller)/incentives/index.tsx');
    const managerScreenCode = readSource('src/app/(manager)/incentives/index.tsx');

    assert.ok(sellerApiCode.includes('??\n      100') || sellerApiCode.includes('100;'), 'sellerApi must default ratePerPacketPaise to 100');
    assert.ok(!sellerApiCode.includes(': 500'), 'sellerApi must not hardcode ₹5.00 (500 paise) default');
    assert.ok(!sellerApiCode.includes('?? 500'), 'sellerApi must not fallback ratePerPacketPaise to 500 paise');
    assert.ok(!adminScreenCode.includes("useState('15.00')"), 'admin incentives modal must default rate to ₹1.00, not ₹15.00');
    assert.ok(!adminScreenCode.includes('|| 1500'), 'admin incentives policy banner must default to 100 paise (₹1.00)');
    assert.ok(sellerScreenCode.includes('ratePerPacketPaise ?? 100'), 'seller incentives screen must default rate to 100 paise (₹1.00)');
    assert.ok(managerScreenCode.includes('data?.ratePerPacketPaise ??\n      100'), 'manager incentives screen must default rate to 100 paise (₹1.00)');
  });

  it('admin incentives maps backend earned/paid/outstanding fields, deduplicates users, and supports applyToUnpaid', () => {
    const adminApiCode = readSource('src/api/admin.ts');
    const adminScreenCode = readSource('src/app/(admin)/incentives/index.tsx');

    assert.ok(adminApiCode.includes('body.applyToUnpaid = payload.applyToUnpaid'), 'adminApi.updateIncentiveSettings must forward applyToUnpaid');
    assert.ok(adminScreenCode.includes('item.adjustedEntitlementPaise'), 'admin employee card must read adjustedEntitlementPaise/earnedPaise');
    assert.ok(adminScreenCode.includes('detailsData.summary?.adjustedEntitlementPaise'), 'admin ledger modal must read adjustedEntitlementPaise / totalPaidPaise');
    assert.ok(adminScreenCode.includes('applyToUnpaid: applyGlobalToUnpaid'), 'admin global rate save must pass applyToUnpaid');
    assert.ok(adminScreenCode.includes('applyToUnpaid: applyUserRateToUnpaid'), 'admin user rate save must pass applyToUnpaid');
  });

  it('manager incentives supports dual-role direct sales visibility and non-zero packet incentive fallback', () => {
    const managerScreenCode = readSource('src/app/(manager)/incentives/index.tsx');

    assert.ok(managerScreenCode.includes('setAutoSelectedPersonal(true)'), 'dual-role manager with 0 assigned sellers auto-focuses My Bonus or surfaces direct sales');
    assert.ok(managerScreenCode.includes('Dual Role: Direct Field Sales Bonus'), 'team tab surfaces direct field bonus card instead of dead-end empty state for dual-role managers');
    assert.ok(managerScreenCode.includes('personalSummary.adjustedEntitlementPaise'), 'manager personal bonus reads adjustedEntitlementPaise/salesIncentivePaise');
    assert.ok(managerScreenCode.includes('Confirmed Sales Breakdown'), 'manager personal bonus shows itemized confirmed direct sales');
  });

  it('seller incentives shows lifetime packets/earnings (not only empty calendar month) and itemized breakdown', () => {
    const sellerApiCode = readSource('src/api/seller.ts');
    const sellerScreenCode = readSource('src/app/(seller)/incentives/index.tsx');

    assert.ok(sellerApiCode.includes('totalEarnedPaise'), 'sellerApi returns overall totalEarnedPaise');
    assert.ok(sellerApiCode.includes('adjustedEntitlementPaise: summary?.adjustedEntitlementPaise'), 'sellerApi returns adjustedEntitlementPaise');
    assert.ok(sellerScreenCode.includes('Total Earned Commission'), 'seller screen displays total earned commission headline');
    assert.ok(sellerScreenCode.includes('Confirmed Sale Incentives'), 'seller screen renders confirmed sale items');
  });

  it('wires in-app PdfPreviewModal (preview + Share PDF) into both manager and seller sales screens', () => {
    const managerSalesCode = readSource('src/app/(manager)/sales/index.tsx');
    const sellerSaleDetailCode = readSource('src/app/(seller)/sales/[id].tsx');
    const sellerSalesListCode = readSource('src/app/(seller)/sales/index.tsx');

    assert.ok(managerSalesCode.includes("import { PdfPreviewModal } from '@/components/common/PdfPreviewModal'"), 'manager sales imports PdfPreviewModal');
    assert.ok(managerSalesCode.includes('setPdfPreview({') && managerSalesCode.includes('<PdfPreviewModal'), 'manager sales opens in-app PDF preview on Tax Invoice');

    assert.ok(sellerSaleDetailCode.includes("import { PdfPreviewModal } from '@/components/common/PdfPreviewModal'"), 'seller sale detail imports PdfPreviewModal');
    assert.ok(sellerSaleDetailCode.includes('setPdfPreview({') && sellerSaleDetailCode.includes('<PdfPreviewModal'), 'seller sale detail opens in-app PDF preview on Tax Invoice');
    assert.ok(sellerSaleDetailCode.includes('View & Share Tax Invoice (PDF)'), 'seller sale detail button reflects in-app preview + share');

    assert.ok(sellerSalesListCode.includes("import { PdfPreviewModal } from '@/components/common/PdfPreviewModal'"), 'seller sales list imports PdfPreviewModal');
    assert.ok(sellerSalesListCode.includes('handleOpenInvoice(item)') && sellerSalesListCode.includes('Tax Invoice'), 'seller sales list exposes quick in-app Tax Invoice preview on confirmed sales');

    const pdfPreviewModalCode = readSource('src/components/common/PdfPreviewModal.tsx');
    assert.ok(pdfPreviewModalCode.includes('freshUrl') && pdfPreviewModalCode.includes('_t=${Date.now()}'), 'PdfPreviewModal always re-fetches updated server PDF with offline cache fallback');
  });
});
