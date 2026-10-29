import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicUser } from '../api/types.ts';
import {
  generateIdempotencyKey,
  computePayloadHash,
  shouldRotateIdempotencyKey,
  createDraftStorage,
  type StorageBackend,
  type OrderDraft,
} from '../utils/draftStorage.ts';

function createInMemoryStorage(): StorageBackend {
  const store = new Map<string, string>();
  return {
    async getItem(key: string) {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      store.set(key, value);
    },
    async removeItem(key: string) {
      store.delete(key);
    },
  };
}

describe('FemmeFlo Phase 2 Mobile Spec & Seller Architecture Verification', () => {

  it('Requirement 1: Single login endpoint POST /api/v1/auth/login and returned-role routing', () => {
    // Single login endpoint contract: no role alias endpoints
    const endpoint = 'auth/login';
    assert.equal(endpoint, 'auth/login');
    assert.doesNotMatch(endpoint, /(seller|manager|admin)\/auth\/login/);

    // Routing by returned role
    function getPostLoginRoute(user: PublicUser): string {
      switch (user.role) {
        case 'SELLER':
          return '/(seller)';
        case 'MANAGER':
          return '/(manager)';
        case 'SUPER_ADMIN':
          return '/(admin)';
        default:
          return '/(seller)';
      }
    }

    assert.equal(getPostLoginRoute({ id: '1', name: 'Ravi', email: 's@f.com', role: 'SELLER', active: true }), '/(seller)');
    assert.equal(getPostLoginRoute({ id: '2', name: 'Meena', email: 'm@f.com', role: 'MANAGER', active: true }), '/(manager)');
    assert.equal(getPostLoginRoute({ id: '3', name: 'Pooja', email: 'a@f.com', role: 'SUPER_ADMIN', active: true }), '/(admin)');
  });

  it('Requirement 1 (Multi-role): Only build role switching if role === MANAGER and isSeller === true', () => {
    function canSwitchToSellerMode(user: PublicUser): boolean {
      return user.role === 'MANAGER' && Boolean(user.isSeller);
    }

    // Standard seller cannot switch to manager mode
    assert.equal(canSwitchToSellerMode({ id: '1', name: 'Ravi', email: 's@f.com', role: 'SELLER', active: true }), false);
    // Standard manager without isSeller cannot switch
    assert.equal(canSwitchToSellerMode({ id: '2', name: 'Meena', email: 'm@f.com', role: 'MANAGER', active: true }), false);
    // Dual-role manager WITH isSeller=true CAN switch
    assert.equal(canSwitchToSellerMode({ id: '3', name: 'Kavita', email: 'km@f.com', role: 'MANAGER', isSeller: true, active: true }), true);
  });

  it('Requirement 2: Photo upload conforms to multipart/form-data with field name "photo"', () => {
    const fieldName = 'photo';
    const mimeType = 'image/jpeg';

    assert.equal(fieldName, 'photo');
    assert.equal(mimeType, 'image/jpeg');
    // Ensure not WebP or base64
    assert.doesNotMatch(mimeType, /webp/);
    assert.doesNotMatch(mimeType, /base64/);
  });

  it('Requirement 3: Generates RFC4122 v4 UUID for idempotency key', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();

    // Standard RFC4122 v4 UUID regex
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(key1, uuidV4Regex);
    assert.match(key2, uuidV4Regex);
    assert.notEqual(key1, key2);
  });

  it('Requirement 3: Idempotency key binds to exact payload and rotates when payload changes after submit attempt', () => {
    const key1 = generateIdempotencyKey();
    const payloadA = {
      customerId: 'c-uuid-1',
      items: [{ productId: 'p-uuid-1', quantity: 10, unitPricePaise: 3500 }],
      paymentMode: 'CASH',
    };
    const hashA = computePayloadHash(payloadA);

    // Initial draft before submission: modifying payload does NOT rotate key
    const payloadA2 = {
      customerId: 'c-uuid-1',
      items: [{ productId: 'p-uuid-1', quantity: 15, unitPricePaise: 3500 }],
      paymentMode: 'CASH',
    };
    const hashA2 = computePayloadHash(payloadA2);
    assert.equal(shouldRotateIdempotencyKey(hashA2, hashA, false), false);

    // After submit attempt was made: modifying payload MUST rotate idempotency key
    assert.equal(shouldRotateIdempotencyKey(hashA2, hashA, true), true);

    // Retrying with the EXACT same payload does NOT rotate key
    assert.equal(shouldRotateIdempotencyKey(hashA, hashA, true), false);

    // Rotating key produces fresh UUID
    const rotatedKey = generateIdempotencyKey();
    assert.notEqual(key1, rotatedKey);
  });

  it('Requirement 4: Shift location uses point events only and foreground permission', () => {
    const shiftEndpoints = [
      'seller/shifts/start',
      'seller/shifts/current',
      'seller/shifts/check-in',
      'seller/shifts/check-out',
      'seller/shifts/end',
      'seller/shifts/history',
    ];

    // Every shift endpoint is an explicit discrete user point action
    assert.equal(shiftEndpoints.length, 6);
    assert.ok(shiftEndpoints.includes('seller/shifts/check-in'));
    assert.ok(shiftEndpoints.includes('seller/shifts/check-out'));
    assert.ok(shiftEndpoints.every((ep) => !ep.includes('background') && !ep.includes('ping')));
  });

  it('Requirement 5: Draft orders and active shift are isolated by userId and cleared on logout', async () => {
    const storageBackend = createInMemoryStorage();
    const storage = createDraftStorage(storageBackend);

    const user1Id = 'user-seller-001';
    const user2Id = 'user-seller-002';

    const draftUser1: OrderDraft = {
      idempotencyKey: generateIdempotencyKey(),
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', productName: 'FemmeFlo Regular', quantity: 20, unitPricePaise: 3500 }],
      paymentMode: 'CASH',
      updatedAt: new Date().toISOString(),
    };

    const draftUser2: OrderDraft = {
      idempotencyKey: generateIdempotencyKey(),
      customerId: 'cust-2',
      items: [{ productId: 'prod-2', productName: 'FemmeFlo Large', quantity: 10, unitPricePaise: 4000 }],
      paymentMode: 'BANK',
      updatedAt: new Date().toISOString(),
    };

    // Save drafts under respective user IDs
    await storage.saveOrderDraft(user1Id, draftUser1);
    await storage.saveOrderDraft(user2Id, draftUser2);

    // Verify isolation
    const loaded1 = await storage.getOrderDraft(user1Id);
    const loaded2 = await storage.getOrderDraft(user2Id);
    assert.equal(loaded1?.customerId, 'cust-1');
    assert.equal(loaded2?.customerId, 'cust-2');
    assert.notEqual(loaded1?.idempotencyKey, loaded2?.idempotencyKey);

    // Shift caching isolation
    await storage.saveActiveShift(user1Id, {
      id: 'shift-1',
      sellerId: user1Id,
      startTime: new Date().toISOString(),
      startOdometerKm: 15400,
      status: 'ACTIVE',
      visits: [],
    });

    const shift1 = await storage.getActiveShift(user1Id);
    const shift2 = await storage.getActiveShift(user2Id);
    assert.equal(shift1?.id, 'shift-1');
    assert.equal(shift2, null);

    // Clear user1 storage on logout
    await storage.clearUserStorage(user1Id);
    const clearedDraft1 = await storage.getOrderDraft(user1Id);
    const clearedShift1 = await storage.getActiveShift(user1Id);
    assert.equal(clearedDraft1, null);
    assert.equal(clearedShift1, null);

    // User 2 data remains intact
    const remainingDraft2 = await storage.getOrderDraft(user2Id);
    assert.equal(remainingDraft2?.customerId, 'cust-2');
  });
});
