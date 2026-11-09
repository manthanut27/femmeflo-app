import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RequestRateLimiter } from '../utils/rateLimiter.ts';
import { LoginAttemptLimiter } from '../utils/loginLimiter.ts';
import { CacheManager } from '../utils/cacheManager.ts';
import type { StorageBackend } from '../utils/draftStorage.ts';

function createMockStorage(): StorageBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(key: string) {
      return data.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      data.set(key, value);
    },
    async removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe('FemmeFlo Rate Limiting, Login Attempt Security & Caching System', () => {

  // ----------------------------------------------------
  // 1. Client-Side Request Rate Limiter
  // ----------------------------------------------------
  describe('Pillar 1: Request Rate Limiter', () => {
    it('correctly categorizes API endpoints into rate limit buckets', () => {
      const limiter = new RequestRateLimiter();

      assert.equal(limiter.getCategory('auth/login', 'POST'), 'auth');
      assert.equal(limiter.getCategory('/auth/me', 'GET'), 'auth');
      assert.equal(limiter.getCategory('seller/sales', 'POST'), 'mutation');
      assert.equal(limiter.getCategory('admin/inventory/transfers', 'POST'), 'mutation');
      assert.equal(limiter.getCategory('admin/products/p1', 'PUT'), 'mutation');
      assert.equal(limiter.getCategory('admin/products/p1', 'DELETE'), 'mutation');
      assert.equal(limiter.getCategory('seller/customers', 'GET'), 'read');
      assert.equal(limiter.getCategory('seller/inventory', 'GET'), 'read');
      assert.equal(limiter.getCategory('geo/pincode/400601', 'GET'), 'search');
    });

    it('enforces request rate limits within sliding time window', () => {
      const limiter = new RequestRateLimiter();
      // Configure low limit for testing: max 3 requests per 1000ms
      limiter.setConfig('test_endpoint', { maxRequests: 3, windowMs: 1000 });

      // Request 1: allowed
      const res1 = limiter.checkLimit('test_endpoint', 'test_endpoint');
      assert.equal(res1.allowed, true);
      assert.equal(res1.remaining, 3);
      limiter.recordRequest('test_endpoint');

      // Request 2: allowed
      const res2 = limiter.checkLimit('test_endpoint', 'test_endpoint');
      assert.equal(res2.allowed, true);
      assert.equal(res2.remaining, 2);
      limiter.recordRequest('test_endpoint');

      // Request 3: allowed
      const res3 = limiter.checkLimit('test_endpoint', 'test_endpoint');
      assert.equal(res3.allowed, true);
      assert.equal(res3.remaining, 1);
      limiter.recordRequest('test_endpoint');

      // Request 4: blocked (rate limit exceeded)
      const res4 = limiter.checkLimit('test_endpoint', 'test_endpoint');
      assert.equal(res4.allowed, false);
      assert.equal(res4.remaining, 0);
      assert.ok(res4.retryAfterSeconds >= 1, 'Retry after seconds should be >= 1');
      assert.ok(res4.resetMs > 0, 'Reset ms should be > 0');
    });

    it('enforces server HTTP 429 lockout duration', () => {
      const limiter = new RequestRateLimiter();

      // Simulate receiving HTTP 429 with Retry-After: 5 seconds
      limiter.setLockout('busy_server_endpoint', 5);

      const check = limiter.checkLimit('busy_server_endpoint');
      assert.equal(check.allowed, false);
      assert.ok(check.retryAfterSeconds >= 4 && check.retryAfterSeconds <= 5);

      // Reset lockout
      limiter.reset('busy_server_endpoint');
      const resetCheck = limiter.checkLimit('busy_server_endpoint');
      assert.equal(resetCheck.allowed, true);
    });
  });

  // ----------------------------------------------------
  // 2. Login Attempt Limiter & Brute-Force Protection
  // ----------------------------------------------------
  describe('Pillar 2: Login Attempt Limiter & Account Lockout', () => {
    it('tracks failed login attempts and initiates lockout after 5 failures', async () => {
      const mockStorage = createMockStorage();
      const loginLimiter = new LoginAttemptLimiter(mockStorage, {
        maxAttempts: 5,
        initialLockoutSeconds: 60,
        escalatedLockoutSeconds: 300,
        attemptWindowMs: 10000,
      });

      const user = 'seller_village_01@femmeflo.com';

      // Initial clean state
      const initial = await loginLimiter.getStatus(user);
      assert.equal(initial.isLocked, false);
      assert.equal(initial.failedAttempts, 0);
      assert.equal(initial.remainingAttempts, 5);
      assert.equal(initial.warningMessage, null);

      // Failed attempt 1
      const fail1 = await loginLimiter.recordFailedAttempt(user);
      assert.equal(fail1.isLocked, false);
      assert.equal(fail1.failedAttempts, 1);
      assert.equal(fail1.remainingAttempts, 4);

      // Failed attempt 2 & 3
      await loginLimiter.recordFailedAttempt(user);
      const fail3 = await loginLimiter.recordFailedAttempt(user);
      assert.equal(fail3.failedAttempts, 3);
      assert.equal(fail3.remainingAttempts, 2);
      assert.ok(fail3.warningMessage?.includes('2 attempts remaining'));

      // Failed attempt 4
      const fail4 = await loginLimiter.recordFailedAttempt(user);
      assert.equal(fail4.failedAttempts, 4);
      assert.equal(fail4.remainingAttempts, 1);
      assert.ok(fail4.warningMessage?.includes('1 attempt remaining'));

      // Failed attempt 5 -> LOCKOUT TRIGGERED!
      const fail5 = await loginLimiter.recordFailedAttempt(user);
      assert.equal(fail5.isLocked, true);
      assert.equal(fail5.remainingAttempts, 0);
      assert.ok(fail5.lockoutRemainingSeconds >= 58 && fail5.lockoutRemainingSeconds <= 60);
      assert.ok(fail5.warningMessage?.includes('Account locked'));
    });

    it('persists lockout in storage across app restarts', async () => {
      const sharedStorage = createMockStorage();

      // Session 1: User fails 5 times and is locked
      const session1 = new LoginAttemptLimiter(sharedStorage, {
        maxAttempts: 5,
        initialLockoutSeconds: 60,
      });
      const user = 'manager_pune@femmeflo.com';
      for (let i = 0; i < 5; i++) {
        await session1.recordFailedAttempt(user);
      }
      const status1 = await session1.getStatus(user);
      assert.equal(status1.isLocked, true);

      // Session 2: User force-closes and restarts app (new LoginAttemptLimiter instance with same storage)
      const session2 = new LoginAttemptLimiter(sharedStorage, {
        maxAttempts: 5,
        initialLockoutSeconds: 60,
      });
      const status2 = await session2.getStatus(user);
      assert.equal(status2.isLocked, true, 'Lockout must be retained from persistent storage');
      assert.ok(status2.lockoutRemainingSeconds > 0);
    });

    it('resets failed attempts on successful login', async () => {
      const mockStorage = createMockStorage();
      const loginLimiter = new LoginAttemptLimiter(mockStorage);
      const user = 'admin_mumbai@femmeflo.com';

      // 3 failed attempts
      await loginLimiter.recordFailedAttempt(user);
      await loginLimiter.recordFailedAttempt(user);
      await loginLimiter.recordFailedAttempt(user);
      const beforeSuccess = await loginLimiter.getStatus(user);
      assert.equal(beforeSuccess.failedAttempts, 3);

      // Successful login
      await loginLimiter.recordSuccessfulLogin(user);

      // Status should be clean
      const afterSuccess = await loginLimiter.getStatus(user);
      assert.equal(afterSuccess.failedAttempts, 0);
      assert.equal(afterSuccess.remainingAttempts, 5);
      assert.equal(afterSuccess.isLocked, false);
      assert.equal(afterSuccess.warningMessage, null);
    });
  });

  // ----------------------------------------------------
  // 3. Multi-Tier Caching System
  // ----------------------------------------------------
  describe('Pillar 3: Multi-Tier Caching System', () => {
    it('stores and retrieves data from L1 Memory and L2 Disk storage', async () => {
      const mockStorage = createMockStorage();
      const cache = new CacheManager(mockStorage);

      const productsData = [
        { id: 'p1', name: 'Ultra Comfort Regular', sku: 'FF-UCR-01', basePricePaise: 2500 },
        { id: 'p2', name: 'Super Night Care XL', sku: 'FF-SNC-02', basePricePaise: 3000 },
      ];

      // Set cache with 10-minute TTL
      await cache.set('seller/products', productsData, {
        ttlMs: 10 * 60 * 1000,
        tags: ['products', 'master_data'],
      });

      // L1 Read
      const entry = await cache.get<typeof productsData>('seller/products');
      assert.ok(entry);
      assert.equal(entry.data.length, 2);
      assert.equal(entry.data[0].name, 'Ultra Comfort Regular');

      // Verify persistent storage write in L2
      assert.ok(mockStorage.data.has('@femmeflo_cache_seller/products'));

      // New CacheManager instance (simulating app relaunch) recovers from L2 storage
      const newCache = new CacheManager(mockStorage);
      const diskEntry = await newCache.get<typeof productsData>('seller/products');
      assert.ok(diskEntry);
      assert.equal(diskEntry.data.length, 2);
    });

    it('enforces TTL expiration and respects allowStale for offline mode', async () => {
      const mockStorage = createMockStorage();
      const cache = new CacheManager(mockStorage);

      // Entry with 10ms TTL
      await cache.set('dashboard_metrics', { revenuePaise: 500000 }, { ttlMs: 10 });

      // Immediate read (fresh)
      const fresh = await cache.get('dashboard_metrics');
      assert.ok(fresh, 'Fresh entry should be returned');

      // Wait 25ms for expiration
      await new Promise((resolve) => setTimeout(resolve, 25));

      // Standard read (expired) -> returns null
      const expired = await cache.get('dashboard_metrics');
      assert.equal(expired, null, 'Expired entry should return null by default');

      // Stale read (offline fallback) -> returns cached data even if expired
      const stale = await cache.get<{ revenuePaise: number }>('dashboard_metrics', { allowStale: true });
      assert.ok(stale, 'Stale read must return cached data for offline fallback');
      assert.equal(stale.data.revenuePaise, 500000);
    });

    it('invalidates related cache entries when mutations succeed', async () => {
      const mockStorage = createMockStorage();
      const cache = new CacheManager(mockStorage);

      // Populate multiple caches
      await cache.set('seller/customers', [{ id: 'c1', name: 'Balaji Store' }], { tags: ['customers'] });
      await cache.set('seller/inventory', { balance: 450 }, { tags: ['inventory'] });
      await cache.set('seller/sales', [{ id: 's1', totalPaise: 5000 }], { tags: ['sales'] });
      await cache.set('seller/dashboard', { todayOrdersCount: 5 }, { tags: ['dashboard'] });

      // Confirm all are present
      assert.ok(await cache.get('seller/customers'));
      assert.ok(await cache.get('seller/inventory'));
      assert.ok(await cache.get('seller/sales'));
      assert.ok(await cache.get('seller/dashboard'));

      // Mutation 1: Adding a new customer invalidates 'customers' and 'dashboard'
      const customerMutationTags = cache.resolveMutationInvalidationTags('seller/customers', 'POST');
      assert.deepEqual(customerMutationTags.sort(), ['customers', 'dashboard'].sort());

      await cache.invalidateByTags(customerMutationTags);

      // Customers and dashboard are invalidated
      assert.equal(await cache.get('seller/customers'), null);
      assert.equal(await cache.get('seller/dashboard'), null);

      // Inventory and sales remain intact
      assert.ok(await cache.get('seller/inventory'));
      assert.ok(await cache.get('seller/sales'));

      // Mutation 2: Recording a sale invalidates 'sales', 'inventory', 'dashboard', 'shifts'
      const saleMutationTags = cache.resolveMutationInvalidationTags('seller/sales', 'POST');
      await cache.invalidateByTags(saleMutationTags);

      assert.equal(await cache.get('seller/sales'), null);
      assert.equal(await cache.get('seller/inventory'), null);
    });

    it('clearAll wipes all memory entries and disk storage on logout', async () => {
      const mockStorage = createMockStorage();
      const cache = new CacheManager(mockStorage);

      await cache.set('key1', 'data1', { tags: ['tagA'] });
      await cache.set('key2', 'data2', { tags: ['tagB'] });

      assert.ok(await cache.get('key1'));
      assert.ok(await cache.get('key2'));

      // User logs out -> wipe all cache
      await cache.clearAll();

      assert.equal(await cache.get('key1'), null);
      assert.equal(await cache.get('key2'), null);
      assert.equal(mockStorage.data.has('@femmeflo_cache_key1'), false);
      assert.equal(mockStorage.data.has('@femmeflo_cache_key2'), false);
    });
  });
});
