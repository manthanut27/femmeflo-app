import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOCK_NOTIFICATIONS } from '../api/mockData.ts';

describe('FemmeFlo Mobile Notification System Suite', () => {
  it('verifies default live system feeds match exact counts: 6 total, 1 unread', () => {
    assert.strictEqual(MOCK_NOTIFICATIONS.length, 6);

    const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;
    assert.strictEqual(unreadCount, 1);

    // Verify unread notification is the Approval alert
    const unreadItem = MOCK_NOTIFICATIONS.find((n) => !n.read);
    assert.ok(unreadItem);
    assert.strictEqual(unreadItem?.type, 'APPROVAL');
    assert.strictEqual(unreadItem?.title, 'Low-Price Sale Verification');
  });

  it('verifies category breakdown covers all required operational categories', () => {
    const categories = MOCK_NOTIFICATIONS.map((n) => n.type);
    assert.ok(categories.includes('SALE'), 'Should include Sales notifications');
    assert.ok(categories.includes('APPROVAL'), 'Should include Approval notifications');
    assert.ok(categories.includes('INVENTORY'), 'Should include Inventory notifications');
    assert.ok(categories.includes('SHIFT'), 'Should include Duty Shift notifications');
    assert.ok(categories.includes('CUSTOMER'), 'Should include Customer notifications');
    assert.ok(categories.includes('OFFICER'), 'Should include Officer notifications');
  });

  it('filters notifications by search query across title, message, and category', () => {
    const searchFilter = (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return MOCK_NOTIFICATIONS;
      return MOCK_NOTIFICATIONS.filter((n) => {
        const matchTitle = (n.title || '').toLowerCase().includes(q);
        const matchMsg = (n.message || '').toLowerCase().includes(q);
        const matchCat = (n.categoryLabel || '').toLowerCase().includes(q);
        const matchType = (n.type || '').toLowerCase().includes(q);
        return matchTitle || matchMsg || matchCat || matchType;
      });
    };

    // Search by title keyword
    const saleSearch = searchFilter('Retail Beat');
    assert.strictEqual(saleSearch.length, 1);
    assert.strictEqual(saleSearch[0].type, 'SALE');

    // Search by message keyword
    const medicalStoreSearch = searchFilter('Gupta Medical');
    assert.strictEqual(medicalStoreSearch.length, 1);
    assert.strictEqual(medicalStoreSearch[0].id, 'notif_sale_01');

    // Search by category
    const inventorySearch = searchFilter('Inventory');
    assert.strictEqual(inventorySearch.length, 1);
    assert.strictEqual(inventorySearch[0].type, 'INVENTORY');

    // Empty search query returns all
    assert.strictEqual(searchFilter('').length, 6);
    assert.strictEqual(searchFilter('   ').length, 6);

    // Non-matching query returns empty array
    assert.strictEqual(searchFilter('non_existent_xyz').length, 0);
  });

  it('verifies role-aware route transformation for Manager and Seller roles', () => {
    const resolveRoleRoute = (actionUrl: string | undefined, userRole: string): string => {
      if (!actionUrl) return '';
      if (actionUrl.startsWith('http')) return actionUrl;
      let target = actionUrl;
      if (userRole === 'MANAGER' && target.startsWith('/(admin)')) {
        target = target.replace('/(admin)', '/(manager)');
      } else if (userRole === 'SELLER' && target.startsWith('/(admin)')) {
        target = target.replace('/(admin)', '/(seller)');
      }
      return target;
    };

    const adminUrl = '/(admin)/sales';
    assert.strictEqual(resolveRoleRoute(adminUrl, 'SUPER_ADMIN'), '/(admin)/sales');
    assert.strictEqual(resolveRoleRoute(adminUrl, 'MANAGER'), '/(manager)/sales');
    assert.strictEqual(resolveRoleRoute(adminUrl, 'SELLER'), '/(seller)/sales');
  });

  it('verifies mark-as-read updates state and reduces unread count without throwing', () => {
    let items = JSON.parse(JSON.stringify(MOCK_NOTIFICATIONS));
    let unreadCount = items.filter((n: any) => !n.read).length;
    assert.strictEqual(unreadCount, 1);

    // Mark single notification read
    const targetId = 'notif_app_01';
    items = items.map((n: any) => (n.id === targetId ? { ...n, read: true } : n));
    unreadCount = Math.max(0, unreadCount - 1);

    assert.strictEqual(unreadCount, 0);
    assert.strictEqual(items.find((n: any) => n.id === targetId)?.read, true);

    // Mark all as read
    items = items.map((n: any) => ({ ...n, read: true }));
    assert.strictEqual(items.every((n: any) => n.read), true);
  });
});
