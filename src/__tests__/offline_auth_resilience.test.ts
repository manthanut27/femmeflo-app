import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import type { AuthRole, PublicUser } from '../api/types.ts';

// Authentication state definition matching AuthContext.tsx
export type AuthState =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'OFFLINE_AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED';

// Navigation resolver reproducing src/app/index.tsx logic
export function resolveStartupRoute(params: {
  state: AuthState;
  isLoading: boolean;
  user: PublicUser | null;
  role: AuthRole | null;
}): string | null {
  const { state, isLoading, user, role } = params;
  if (isLoading || state === 'INITIALIZING') {
    return null; // Hold navigation, display loading spinner
  }

  if (state === 'UNAUTHENTICATED' || state === 'SESSION_EXPIRED' || !user || !role) {
    return '/(auth)/login';
  }

  if (role === 'SUPER_ADMIN') {
    return '/(admin)';
  } else if (role === 'MANAGER') {
    return '/(manager)';
  } else if (role === 'SELLER') {
    return '/(seller)';
  } else {
    return '/(auth)/login';
  }
}

// Layout guard resolver reproducing src/app/(admin)/_layout.tsx logic
export function evaluateAdminGuard(params: {
  state: AuthState;
  isLoading: boolean;
  user: PublicUser | null;
  role: AuthRole | null;
}): string | 'ALLOW' | null {
  const { state, isLoading, user, role } = params;
  if (isLoading || state === 'INITIALIZING') return null;

  if (!user || state === 'UNAUTHENTICATED' || state === 'SESSION_EXPIRED') {
    return '/(auth)/login';
  }

  if (role !== 'SUPER_ADMIN') {
    if (role === 'MANAGER') return '/(manager)';
    if (role === 'SELLER') return '/(seller)';
    return '/(auth)/login';
  }

  return 'ALLOW';
}

// Layout guard resolver reproducing src/app/(seller)/_layout.tsx logic
export function evaluateSellerGuard(params: {
  state: AuthState;
  isLoading: boolean;
  user: PublicUser | null;
  role: AuthRole | null;
}): string | 'ALLOW' | null {
  const { state, isLoading, user, role } = params;
  if (isLoading || state === 'INITIALIZING') return null;

  if (!user || state === 'UNAUTHENTICATED' || state === 'SESSION_EXPIRED') {
    return '/(auth)/login';
  }

  if (role !== 'SELLER') {
    if (role === 'SUPER_ADMIN') return '/(admin)';
    if (role === 'MANAGER') return '/(manager)';
    return '/(auth)/login';
  }

  return 'ALLOW';
}

// Storage simulator isolating SecureStore (tokens) and AsyncStorage (profile)
export class MockSessionStorage {
  private secureToken: string | null = null;
  private cachedProfile: string | null = null;

  async getToken(): Promise<string | null> {
    return this.secureToken;
  }

  async setToken(token: string): Promise<void> {
    this.secureToken = token;
  }

  async clearToken(): Promise<void> {
    this.secureToken = null;
    this.cachedProfile = null;
  }

  async getCachedUser(): Promise<PublicUser | null> {
    if (!this.cachedProfile) return null;
    try {
      const parsed = JSON.parse(this.cachedProfile);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.role) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async setCachedUser(user: PublicUser): Promise<void> {
    this.cachedProfile = JSON.stringify(user);
  }

  async clearCachedUser(): Promise<void> {
    this.cachedProfile = null;
  }
}

// Session engine reproducing AuthContext.tsx restoreSession logic
export class SessionRestoreEngine {
  public state: AuthState = 'INITIALIZING';
  public user: PublicUser | null = null;
  public token: string | null = null;
  public isActionLoading: boolean = false;
  public storage: MockSessionStorage;
  public backendMeHandler: (token: string) => Promise<{ user: PublicUser }>;

  constructor(
    storage: MockSessionStorage,
    backendMeHandler: (token: string) => Promise<{ user: PublicUser }>
  ) {
    this.storage = storage;
    this.backendMeHandler = backendMeHandler;
  }

  async restoreSession(): Promise<AuthState> {
    this.state = 'INITIALIZING';
    this.isActionLoading = true;

    try {
      const storedToken = await this.storage.getToken();
      if (!storedToken) {
        this.token = null;
        this.user = null;
        this.state = 'UNAUTHENTICATED';
        return this.state;
      }

      // Purge legacy mock tokens
      if (storedToken.startsWith('mock_jwt_token_')) {
        await this.storage.clearToken();
        this.token = null;
        this.user = null;
        this.state = 'UNAUTHENTICATED';
        return this.state;
      }

      this.token = storedToken;

      try {
        const res = await this.backendMeHandler(storedToken);
        if (res && res.user && res.user.id && res.user.role) {
          this.user = res.user;
          await this.storage.setCachedUser(res.user);
          this.state = 'AUTHENTICATED';
          return this.state;
        } else {
          await this.storage.clearToken();
          this.token = null;
          this.user = null;
          this.state = 'UNAUTHENTICATED';
          return this.state;
        }
      } catch (err: any) {
        const statusCode = err?.statusCode ?? err?.status ?? 0;
        const isNetworkErr = Boolean(err?.isNetworkError) || statusCode === 0;

        if (statusCode === 401 || statusCode === 403) {
          // Explicit token expiration / revocation
          await this.storage.clearToken();
          this.token = null;
          this.user = null;
          this.state = 'SESSION_EXPIRED';
          return this.state;
        } else if (isNetworkErr || statusCode >= 500) {
          // Network failure, offline mode, timeout, or temporary server error
          const cached = await this.storage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_')) {
            this.user = cached;
            this.state = 'OFFLINE_AUTHENTICATED';
            return this.state;
          } else {
            await this.storage.clearToken();
            this.token = null;
            this.user = null;
            this.state = 'UNAUTHENTICATED';
            return this.state;
          }
        } else {
          const cached = await this.storage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_')) {
            this.user = cached;
            this.state = 'OFFLINE_AUTHENTICATED';
            return this.state;
          } else {
            await this.storage.clearToken();
            this.token = null;
            this.user = null;
            this.state = 'UNAUTHENTICATED';
            return this.state;
          }
        }
      }
    } finally {
      this.isActionLoading = false;
    }
  }

  async login(token: string, user: PublicUser): Promise<void> {
    await this.storage.setToken(token);
    await this.storage.setCachedUser(user);
    this.token = token;
    this.user = user;
    this.state = 'AUTHENTICATED';
  }

  async logout(): Promise<void> {
    await this.storage.clearToken();
    this.token = null;
    this.user = null;
    this.state = 'UNAUTHENTICATED';
  }
}

describe('Offline Authentication, Mock User Elimination & Session Resilience Suite', () => {

  // =========================================================================
  // TEST 1: Super Admin login online → close app → disable network → open app
  // EXPECTED RESULT: Super Admin dashboard opens in offline mode (OFFLINE_AUTHENTICATED)
  // =========================================================================
  it('TEST 1: Super Admin login online -> close app -> disable network -> open app', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_1',
      name: 'Executive Super Admin',
      email: 'admin@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    // Step 1: Login online
    const onlineEngine = new SessionRestoreEngine(storage, async () => ({ user: superAdmin }));
    await onlineEngine.login('valid_jwt_admin_token', superAdmin);
    assert.equal(onlineEngine.state, 'AUTHENTICATED');
    assert.equal(onlineEngine.user?.role, 'SUPER_ADMIN');

    // Step 2: Simulate app close and reopening with network disabled (offline error)
    const offlineEngine = new SessionRestoreEngine(storage, async () => {
      const netErr = new Error('Network request failed');
      (netErr as any).isNetworkError = true;
      (netErr as any).statusCode = 0;
      throw netErr;
    });

    const finalState = await offlineEngine.restoreSession();
    assert.equal(finalState, 'OFFLINE_AUTHENTICATED');
    assert.equal(offlineEngine.user?.role, 'SUPER_ADMIN');
    assert.equal(offlineEngine.user?.email, 'admin@femmeflo.internal');

    // Route resolution must navigate directly to /(admin) in offline mode
    const route = resolveStartupRoute({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(route, '/(admin)', 'Super Admin dashboard must open in offline mode');

    // Admin layout guard must allow access
    const guard = evaluateAdminGuard({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(guard, 'ALLOW');
  });

  // =========================================================================
  // TEST 2: Seller login online → close app → disable network → open app
  // EXPECTED RESULT: Seller dashboard opens in offline mode (OFFLINE_AUTHENTICATED)
  // =========================================================================
  it('TEST 2: Seller login online -> close app -> disable network -> open app', async () => {
    const storage = new MockSessionStorage();
    const seller: PublicUser = {
      id: 'usr_seller_42',
      name: 'Field Officer Seller',
      email: 'seller@femmeflo.internal',
      role: 'SELLER',
      active: true,
    };

    // Step 1: Login online
    const onlineEngine = new SessionRestoreEngine(storage, async () => ({ user: seller }));
    await onlineEngine.login('valid_jwt_seller_token', seller);
    assert.equal(onlineEngine.state, 'AUTHENTICATED');
    assert.equal(onlineEngine.user?.role, 'SELLER');

    // Step 2: Reopen offline
    const offlineEngine = new SessionRestoreEngine(storage, async () => {
      const netErr = new Error('Host unreachable');
      (netErr as any).isNetworkError = true;
      (netErr as any).statusCode = 0;
      throw netErr;
    });

    const finalState = await offlineEngine.restoreSession();
    assert.equal(finalState, 'OFFLINE_AUTHENTICATED');
    assert.equal(offlineEngine.user?.role, 'SELLER');

    // Route resolution must navigate directly to /(seller)
    const route = resolveStartupRoute({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(route, '/(seller)', 'Seller dashboard must open in offline mode');

    // Seller layout guard must allow access
    const guard = evaluateSellerGuard({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(guard, 'ALLOW');
  });

  // =========================================================================
  // TEST 3: Super Admin login → close app → disable network → open app
  // MUST VERIFY: Seller dashboard is NOT opened
  // =========================================================================
  it('TEST 3: Super Admin login -> close app -> disable network -> open app (Seller dashboard MUST NOT open)', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_99',
      name: 'Super Admin Officer',
      email: 'admin99@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    await storage.setToken('secure_admin_jwt_token');
    await storage.setCachedUser(superAdmin);

    // Reopen offline
    const offlineEngine = new SessionRestoreEngine(storage, async () => {
      const netErr = new Error('Connection refused');
      (netErr as any).isNetworkError = true;
      (netErr as any).statusCode = 0;
      throw netErr;
    });

    await offlineEngine.restoreSession();

    // Verify user identity is NOT altered or replaced with mock seller
    assert.equal(offlineEngine.user?.role, 'SUPER_ADMIN');
    assert.notEqual(offlineEngine.user?.role, 'SELLER');
    assert.notEqual(offlineEngine.user?.id, 'usr_seller_1');

    // Route resolution MUST NOT return /(seller)
    const route = resolveStartupRoute({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(route, '/(admin)');
    assert.notEqual(route, '/(seller)');

    // Seller layout guard MUST reject Super Admin and redirect to admin portal
    const sellerGuard = evaluateSellerGuard({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(sellerGuard, '/(admin)', 'Seller layout must redirect Super Admin to /(admin), never allow');
  });

  // =========================================================================
  // TEST 4: App opened offline with no previous login
  // EXPECTED RESULT: Login screen displayed. No automatic authentication.
  // =========================================================================
  it('TEST 4: App opened offline with no previous login', async () => {
    const storage = new MockSessionStorage(); // Empty storage

    const offlineEngine = new SessionRestoreEngine(storage, async () => {
      const netErr = new Error('No internet');
      (netErr as any).isNetworkError = true;
      (netErr as any).statusCode = 0;
      throw netErr;
    });

    const finalState = await offlineEngine.restoreSession();
    assert.equal(finalState, 'UNAUTHENTICATED');
    assert.equal(offlineEngine.user, null, 'Must have null user when no previous session exists');
    assert.equal(offlineEngine.token, null, 'Must have null token');

    const route = resolveStartupRoute({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: null,
    });
    assert.equal(route, '/(auth)/login', 'Must navigate to login screen without any auto-login');
  });

  // =========================================================================
  // TEST 5: Super Admin logs out → close app → disable network → open app
  // EXPECTED RESULT: Login screen displayed. No session restored.
  // =========================================================================
  it('TEST 5: Super Admin logs out -> close app -> disable network -> open app', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_1',
      name: 'Super Admin',
      email: 'admin@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    const engine = new SessionRestoreEngine(storage, async () => ({ user: superAdmin }));
    await engine.login('valid_jwt_token', superAdmin);

    // Explicit logout
    await engine.logout();
    assert.equal(engine.state, 'UNAUTHENTICATED');
    assert.equal(engine.user, null);
    assert.equal(engine.token, null);

    // Verify storage is empty
    assert.equal(await storage.getToken(), null);
    assert.equal(await storage.getCachedUser(), null);

    // Reopen offline
    const offlineEngine = new SessionRestoreEngine(storage, async () => {
      const netErr = new Error('Offline');
      (netErr as any).isNetworkError = true;
      throw netErr;
    });

    const finalState = await offlineEngine.restoreSession();
    assert.equal(finalState, 'UNAUTHENTICATED');
    assert.equal(offlineEngine.user, null);

    const route = resolveStartupRoute({
      state: offlineEngine.state,
      isLoading: false,
      user: null,
      role: null,
    });
    assert.equal(route, '/(auth)/login', 'Logged out user must be routed to login screen');
  });

  // =========================================================================
  // TEST 6: Super Admin login → backend returns 500 error during session verification
  // EXPECTED RESULT: Preserve cached identity. Do NOT create mock Seller.
  // =========================================================================
  it('TEST 6: Super Admin login -> backend returns 500 error during session verification', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_executive',
      name: 'Executive Super Admin',
      email: 'admin@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    await storage.setToken('persisted_super_admin_jwt');
    await storage.setCachedUser(superAdmin);

    // Backend returns 500 Internal Server Error / Gateway 502 / 503
    const engine500 = new SessionRestoreEngine(storage, async () => {
      const serverErr = new Error('Internal Server Error');
      (serverErr as any).statusCode = 500;
      throw serverErr;
    });

    const finalState = await engine500.restoreSession();
    assert.equal(finalState, 'OFFLINE_AUTHENTICATED');
    assert.ok(engine500.user, 'Cached identity must be preserved');
    assert.equal(engine500.user?.role, 'SUPER_ADMIN');
    assert.notEqual(engine500.user?.role, 'SELLER', 'Must NOT create mock Seller');

    const route = resolveStartupRoute({
      state: engine500.state,
      isLoading: false,
      user: engine500.user,
      role: engine500.user?.role ?? null,
    });
    assert.equal(route, '/(admin)');
  });

  // =========================================================================
  // TEST 7: Super Admin login → token expires while offline → reopen app offline
  // EXPECTED RESULT: Preserve offline session. Do NOT replace with Seller.
  // =========================================================================
  it('TEST 7: Super Admin login -> token expires while offline -> reopen app offline', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_offline_test',
      name: 'Super Admin',
      email: 'admin@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    await storage.setToken('admin_token_expired_while_offline');
    await storage.setCachedUser(superAdmin);

    // Reopen offline (server cannot be reached to validate timestamp)
    const offlineEngine = new SessionRestoreEngine(storage, async () => {
      const timeoutErr = new Error('Request timed out');
      (timeoutErr as any).isNetworkError = true;
      (timeoutErr as any).statusCode = 0;
      throw timeoutErr;
    });

    const finalState = await offlineEngine.restoreSession();
    assert.equal(finalState, 'OFFLINE_AUTHENTICATED');
    assert.equal(offlineEngine.user?.role, 'SUPER_ADMIN');
    assert.notEqual(offlineEngine.user?.role, 'SELLER', 'Must NEVER replace with Seller');

    const route = resolveStartupRoute({
      state: offlineEngine.state,
      isLoading: false,
      user: offlineEngine.user,
      role: offlineEngine.user?.role ?? null,
    });
    assert.equal(route, '/(admin)');
  });

  // =========================================================================
  // TEST 8: Backend explicitly returns 401 Unauthorized during session verification
  // EXPECTED RESULT: Transition to SESSION_EXPIRED. Wipe storage.
  // =========================================================================
  it('TEST 8: Backend explicitly returns 401 Unauthorized during session verification', async () => {
    const storage = new MockSessionStorage();
    const staleUser: PublicUser = {
      id: 'usr_stale_admin',
      name: 'Stale Admin',
      email: 'stale@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    await storage.setToken('revoked_or_invalid_jwt');
    await storage.setCachedUser(staleUser);

    // Backend explicitly answers with 401 Unauthorized
    const engine401 = new SessionRestoreEngine(storage, async () => {
      const authErr = new Error('Unauthorized - session revoked');
      (authErr as any).statusCode = 401;
      throw authErr;
    });

    const finalState = await engine401.restoreSession();
    assert.equal(finalState, 'SESSION_EXPIRED');
    assert.equal(engine401.user, null, 'User state must be cleared');
    assert.equal(engine401.token, null, 'Token state must be cleared');

    // Storage must be wiped clean
    assert.equal(await storage.getToken(), null, 'Stored token must be wiped');
    assert.equal(await storage.getCachedUser(), null, 'Cached profile must be wiped');

    const route = resolveStartupRoute({
      state: engine401.state,
      isLoading: false,
      user: null,
      role: null,
    });
    assert.equal(route, '/(auth)/login', 'Must navigate to login');
  });

  // =========================================================================
  // TEST 9: Switch from Super Admin to Seller account
  // EXPECTED RESULT: Previous identity completely wiped. No cross-account leakage.
  // =========================================================================
  it('TEST 9: Switch from Super Admin to Seller account', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_original',
      name: 'Executive Super Admin',
      email: 'superadmin@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };
    const seller: PublicUser = {
      id: 'usr_seller_new',
      name: 'Field Seller Officer',
      email: 'seller@femmeflo.internal',
      role: 'SELLER',
      active: true,
    };

    const engine = new SessionRestoreEngine(storage, async () => ({ user: superAdmin }));

    // 1. Super Admin logs in
    await engine.login('token_admin_original', superAdmin);
    assert.equal(engine.user?.role, 'SUPER_ADMIN');

    // 2. Super Admin logs out
    await engine.logout();
    assert.equal(await storage.getToken(), null);
    assert.equal(await storage.getCachedUser(), null);

    // 3. Seller logs in
    await engine.login('token_seller_new', seller);

    // Verify completely separate profile in storage
    const storedToken = await storage.getToken();
    const storedProfile = await storage.getCachedUser();

    assert.equal(storedToken, 'token_seller_new');
    assert.equal(storedProfile?.id, 'usr_seller_new');
    assert.equal(storedProfile?.role, 'SELLER');
    assert.notEqual(storedProfile?.id, 'usr_super_admin_original');
    assert.notEqual(storedProfile?.email, 'superadmin@femmeflo.internal');

    const route = resolveStartupRoute({
      state: engine.state,
      isLoading: false,
      user: engine.user,
      role: engine.user?.role ?? null,
    });
    assert.equal(route, '/(seller)');
  });

  // =========================================================================
  // TEST 10: Slow network startup
  // EXPECTED RESULT: INITIALIZING state holds spinner. No premature navigation.
  // =========================================================================
  it('TEST 10: Slow network startup holds spinner and prevents premature navigation', async () => {
    const storage = new MockSessionStorage();
    const superAdmin: PublicUser = {
      id: 'usr_super_admin_slow',
      name: 'Executive Super Admin',
      email: 'admin@femmeflo.internal',
      role: 'SUPER_ADMIN',
      active: true,
    };

    await storage.setToken('slow_network_admin_token');
    await storage.setCachedUser(superAdmin);

    let resolveSlowMe: (val: any) => void;
    const slowPromise = new Promise((resolve) => {
      resolveSlowMe = resolve;
    });

    const slowEngine = new SessionRestoreEngine(storage, () => slowPromise as any);

    // Kick off restoreSession without awaiting immediately
    const restorePromise = slowEngine.restoreSession();

    // While awaiting backend verification:
    assert.equal(slowEngine.state, 'INITIALIZING', 'State must be INITIALIZING while awaiting backend');
    assert.equal(slowEngine.isActionLoading, true, 'isActionLoading must be true');

    // Resolve startup route while INITIALIZING: MUST hold navigation (return null)
    const earlyRoute = resolveStartupRoute({
      state: slowEngine.state,
      isLoading: slowEngine.isActionLoading,
      user: slowEngine.user,
      role: slowEngine.user?.role ?? null,
    });
    assert.equal(earlyRoute, null, 'Must hold navigation and show spinner during slow network startup');

    // Layout guards must also hold while INITIALIZING
    const earlyAdminGuard = evaluateAdminGuard({
      state: slowEngine.state,
      isLoading: slowEngine.isActionLoading,
      user: slowEngine.user,
      role: slowEngine.user?.role ?? null,
    });
    assert.equal(earlyAdminGuard, null, 'Admin guard must return null while initializing');

    // Now complete the slow backend response
    resolveSlowMe!({ user: superAdmin });
    await restorePromise;

    // After completion, state transitions to AUTHENTICATED
    assert.equal(slowEngine.state, 'AUTHENTICATED');
    assert.equal(slowEngine.isActionLoading, false);

    const readyRoute = resolveStartupRoute({
      state: slowEngine.state,
      isLoading: false,
      user: slowEngine.user,
      role: slowEngine.user?.role ?? null,
    });
    assert.equal(readyRoute, '/(admin)');
  });

  // =========================================================================
  // EXTRA SAFETY TEST: Legacy mock token purge
  // Verify that any old hardcoded mock JWT token is automatically purged
  // =========================================================================
  it('EXTRA SAFETY: Automatically purges legacy mock JWT tokens and forces login', async () => {
    const storage = new MockSessionStorage();
    await storage.setToken('mock_jwt_token_seller');

    const engine = new SessionRestoreEngine(storage, async () => {
      throw new Error('Should not even be called for mock tokens');
    });

    const state = await engine.restoreSession();
    assert.equal(state, 'UNAUTHENTICATED');
    assert.equal(await storage.getToken(), null);
    assert.equal(engine.user, null);
  });
});
