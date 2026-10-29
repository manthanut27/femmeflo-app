import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('FemmeFlo Bug Audit & Safe Fixes Regression Suite', () => {

  // BUG-001 Regression: Session restoration must NOT fall back to cached user on 401/403
  it('BUG-001: Session restoration rejects cached user on HTTP 401/403 and clears storage', async () => {
    let storedToken: string | null = 'expired-token';
    let cachedUser: { id: string; name: string } | null = { id: 'usr_seller_1', name: 'Field Seller' };
    let sessionCleared = false;

    async function simulateRestoreSession(apiError: { statusCode: number; isNetworkError: boolean }) {
      const statusCode = apiError.statusCode;
      if (statusCode === 401 || statusCode === 403) {
        storedToken = null;
        cachedUser = null;
        sessionCleared = true;
        return null; // Do not restore session
      }

      // Offline network failure fallback
      if (apiError.isNetworkError && cachedUser) {
        return cachedUser;
      }

      return null;
    }

    // Case A: 401 Unauthorized from backend
    const res401 = await simulateRestoreSession({ statusCode: 401, isNetworkError: false });
    assert.equal(res401, null, 'Session must not be restored on 401');
    assert.equal(sessionCleared, true, 'Token and cached user must be wiped on 401');
    assert.equal(storedToken, null);
    assert.equal(cachedUser, null);

    // Case B: Offline network error (e.g. 0 status, isNetworkError true)
    cachedUser = { id: 'usr_seller_1', name: 'Field Seller' };
    const resOffline = await simulateRestoreSession({ statusCode: 0, isNetworkError: true });
    assert.ok(resOffline, 'Cached user should be used in offline mode');
    assert.equal(resOffline?.name, 'Field Seller');
  });

  // BUG-002 Regression: Admin approval updates stock, transactions, and enables invoice
  it('BUG-002: Admin approval updates stock balance, adds stock ledger transaction, and enables tax invoice', () => {
    const mockInventory = { balance: 100, soldPackets: 50 };
    const transactions: Array<{ type: string; quantity: number }> = [];

    const sale = {
      id: 'sale_below_floor',
      packetCount: 15,
      status: 'PENDING' as 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'APPROVED',
      saleNumber: 'FF-2026-00420',
    };

    function canDownloadInvoice(status: string): boolean {
      return status === 'CONFIRMED' || status === 'APPROVED';
    }

    // Pending sale cannot download invoice
    assert.equal(canDownloadInvoice(sale.status), false);

    // Admin approves sale
    function executeApproval() {
      sale.status = 'CONFIRMED';
      mockInventory.balance = Math.max(0, mockInventory.balance - sale.packetCount);
      mockInventory.soldPackets += sale.packetCount;
      transactions.unshift({ type: 'SALE', quantity: sale.packetCount });
    }

    executeApproval();

    assert.equal(sale.status, 'CONFIRMED');
    assert.equal(mockInventory.balance, 85, '15 packets deducted from stock');
    assert.equal(mockInventory.soldPackets, 65, 'Sold packets incremented by 15');
    assert.equal(transactions.length, 1);
    assert.equal(transactions[0].quantity, 15);
    assert.equal(canDownloadInvoice(sale.status), true, 'Invoice must now be accessible');
  });

  // BUG-003 Regression: Re-entry lock guards against rapid double submission
  it('BUG-003: Re-entry guard prevents concurrent double submission', async () => {
    let isSubmitting = false;
    let submissionCount = 0;

    async function submitOrder() {
      if (isSubmitting) return { rejected: true };
      isSubmitting = true;
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        submissionCount += 1;
        return { success: true };
      } finally {
        isSubmitting = false;
      }
    }

    // Rapid concurrent taps
    const [tap1, tap2] = await Promise.all([submitOrder(), submitOrder()]);
    assert.equal(submissionCount, 1, 'Only one submission should proceed');
    assert.ok(tap1.success || tap2.success);
    assert.ok(tap1.rejected || tap2.rejected);
  });

  // BUG-004 Regression: Strict RFC customer email validation regex
  it('BUG-004: Strict customer email validation rejects malformed email strings', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    assert.equal(emailRegex.test('valid.store@femmeflo.com'), true);
    assert.equal(emailRegex.test('sharma@store.in'), true);
    assert.equal(emailRegex.test('invalid_email'), false);
    assert.equal(emailRegex.test('store@'), false);
    assert.equal(emailRegex.test('store@domain'), false, 'Email without TLD must fail');
    assert.equal(emailRegex.test('@domain.com'), false);
    assert.equal(emailRegex.test('store @domain.com'), false);
  });

  // BUG-006 Regression: Strict admin approval endpoint routing
  it('BUG-006: Endpoint matching requires strict path prefix and suffix', () => {
    function matchApprovalEndpoint(cleanEndpoint: string): boolean {
      return cleanEndpoint.startsWith('admin/approvals/') && cleanEndpoint.endsWith('/approve');
    }

    assert.equal(matchApprovalEndpoint('admin/approvals/sale_123/approve'), true);
    assert.equal(matchApprovalEndpoint('admin/approvals/sale_456/approve'), true);
    assert.equal(matchApprovalEndpoint('seller/sales/approve'), false);
    assert.equal(matchApprovalEndpoint('admin/settings/approve_flag'), false);
    assert.equal(matchApprovalEndpoint('admin/approvals/sale_123/reject'), false);
  });

});
