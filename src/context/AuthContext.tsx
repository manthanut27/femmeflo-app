import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { cacheManager, requestRateLimiter, setSessionExpiredHandler, tokenStorage } from '../api/client';
import { syncMockServiceUser } from '../api/mockService';
import type { AuthRole, PublicUser } from '../api/types';
import { draftStorage, resolveDefaultStorage } from '../utils/draftStorage';
import { mobileRealtimeSync } from '../services/realtimeSync';

const CACHE_SCHEMA_VERSION_KEY = '@femmeflo_cache_schema_version';
const CURRENT_CACHE_SCHEMA_VERSION = 'v2';

export type AuthState =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'OFFLINE_AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED';

interface AuthContextType {
  user: PublicUser | null;
  token: string | null;
  role: AuthRole | null;
  state: AuthState;
  isLoading: boolean;
  isOffline: boolean;
  login: (identifier: string, password: string, roleHint?: 'admin' | 'manager' | 'seller') => Promise<{ user: PublicUser; token: string }>;
  logout: (specificUserId?: string) => Promise<void>;
  refreshUser: () => Promise<PublicUser | null>;
  updateProfile: (updates: Partial<PublicUser>) => Promise<PublicUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function resolveActivePortalRole(
  userObj: Pick<PublicUser, 'role' | 'isSeller' | 'sessionRole'>,
  preferred?: AuthRole | 'admin' | 'manager' | 'seller' | null
): AuthRole {
  const normalizedPreferred = preferred
    ? preferred === 'admin'
      ? 'SUPER_ADMIN'
      : preferred === 'manager'
        ? 'MANAGER'
        : preferred === 'seller'
          ? 'SELLER'
          : preferred
    : userObj.sessionRole;

  if (
    normalizedPreferred === 'SELLER' &&
    (userObj.role === 'SELLER' || (userObj.role === 'MANAGER' && userObj.isSeller))
  ) {
    return 'SELLER';
  }
  if (
    normalizedPreferred === 'MANAGER' &&
    (userObj.role === 'MANAGER' || userObj.role === 'SUPER_ADMIN')
  ) {
    return 'MANAGER';
  }
  if (normalizedPreferred === 'SUPER_ADMIN' && userObj.role === 'SUPER_ADMIN') {
    return 'SUPER_ADMIN';
  }
  return userObj.role;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionRole, setSessionRoleState] = useState<AuthRole | null>(null);
  const [state, setAuthState] = useState<AuthState>('INITIALIZING');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  async function restoreSession() {
    try {
      setAuthState('INITIALIZING');
      setIsActionLoading(true);

      // One-time purge of stale/mock cache entries left by older app builds
      try {
        const storage = resolveDefaultStorage();
        const ver = await storage.getItem(CACHE_SCHEMA_VERSION_KEY);
        if (ver !== CURRENT_CACHE_SCHEMA_VERSION) {
          await cacheManager.clearAll();
          requestRateLimiter.reset();
          await storage.setItem(CACHE_SCHEMA_VERSION_KEY, CURRENT_CACHE_SCHEMA_VERSION);
        }
      } catch {
        // Ignore version migration errors
      }

      const [storedToken, storedSessionRole] = await Promise.all([
        tokenStorage.getToken(),
        tokenStorage.getSessionRole(),
      ]);
      if (!storedToken) {
        await cacheManager.clearAll().catch(() => {});
        setToken(null);
        setUser(null);
        setSessionRoleState(null);
        setAuthState('UNAUTHENTICATED');
        return;
      }

      // Purge any legacy mock test tokens from storage
      if (storedToken.startsWith('mock_jwt_token_')) {
        await tokenStorage.clearToken();
        await cacheManager.clearAll().catch(() => {});
        setToken(null);
        setUser(null);
        setSessionRoleState(null);
        setAuthState('UNAUTHENTICATED');
        return;
      }

      setToken(storedToken);

      // Verify token with live backend
      try {
        const res = await authApi.me();
        if (res && res.user && res.user.id && res.user.role) {
          const resolvedRole = resolveActivePortalRole(
            res.user,
            res.user.sessionRole ?? storedSessionRole
          );
          const sessionUser: PublicUser = { ...res.user, sessionRole: resolvedRole };
          setUser(sessionUser);
          setSessionRoleState(resolvedRole);
          await tokenStorage.setSessionRole(resolvedRole);
          await tokenStorage.setCachedUser(sessionUser);
          syncMockServiceUser(sessionUser);
          setAuthState('AUTHENTICATED');
        } else {
          await tokenStorage.clearToken();
          await cacheManager.clearAll().catch(() => {});
          setToken(null);
          setUser(null);
          setSessionRoleState(null);
          setAuthState('UNAUTHENTICATED');
        }
      } catch (err: any) {
        // Distinguish explicit backend rejection from network/offline errors
        const statusCode = err?.statusCode ?? err?.status;
        const isNetworkErr = Boolean(err?.isNetworkError) || statusCode === 0;

        if (statusCode === 401 || statusCode === 403) {
          // Token is explicitly expired or revoked by backend
          console.warn('[AuthContext] Backend session revoked or expired (401/403). Clearing session.');
          await tokenStorage.clearToken();
          await cacheManager.clearAll().catch(() => {});
          setToken(null);
          setUser(null);
          setSessionRoleState(null);
          setAuthState('SESSION_EXPIRED');
        } else if (isNetworkErr || statusCode >= 500) {
          // Network failure, timeout, host unreachable, or temporary 5xx gateway error
          // Restore previously authenticated profile from cache without changing user role
          const cached = await tokenStorage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_')) {
            const resolvedRole = resolveActivePortalRole(cached, storedSessionRole ?? cached.sessionRole);
            const sessionUser: PublicUser = { ...cached, sessionRole: resolvedRole };
            console.info(`[AuthContext] Backend unreachable. Restoring cached session for ${resolvedRole} (${cached.email || cached.name}).`);
            setUser(sessionUser);
            setSessionRoleState(resolvedRole);
            syncMockServiceUser(sessionUser);
            setAuthState('OFFLINE_AUTHENTICATED');
          } else {
            // No valid cached user to restore
            console.warn('[AuthContext] Network unreachable and no valid cached profile found.');
            await tokenStorage.clearToken();
            setToken(null);
            setUser(null);
            setSessionRoleState(null);
            setAuthState('UNAUTHENTICATED');
          }
        } else {
          // Other unexpected error (e.g. malformed response)
          const cached = await tokenStorage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_')) {
            const resolvedRole = resolveActivePortalRole(cached, storedSessionRole ?? cached.sessionRole);
            const sessionUser: PublicUser = { ...cached, sessionRole: resolvedRole };
            setUser(sessionUser);
            setSessionRoleState(resolvedRole);
            syncMockServiceUser(sessionUser);
            setAuthState('OFFLINE_AUTHENTICATED');
          } else {
            await tokenStorage.clearToken();
            setToken(null);
            setUser(null);
            setSessionRoleState(null);
            setAuthState('UNAUTHENTICATED');
          }
        }
      }
    } finally {
      setIsActionLoading(false);
    }
  }

  useEffect(() => {
    // Set up session expiry hook to wipe local state and update state machine
    setSessionExpiredHandler(() => {
      tokenStorage.clearToken().catch(() => {});
      cacheManager.clearAll().catch(() => {});
      requestRateLimiter.reset();
      setUser(null);
      setToken(null);
      setSessionRoleState(null);
      setAuthState('SESSION_EXPIRED');
    });

    restoreSession();
  }, []);

  useEffect(() => {
    if (state === 'AUTHENTICATED' && token) {
      mobileRealtimeSync.start();
    } else {
      mobileRealtimeSync.stop();
    }
    return () => {
      mobileRealtimeSync.stop();
    };
  }, [state, token]);

  async function login(identifier: string, password: string, roleHint?: 'admin' | 'manager' | 'seller') {
    setIsActionLoading(true);
    try {
      const res = await authApi.login({ identifier, password, roleHint });
      if (!res.user || !res.user.role || !res.token) {
        throw new Error('Authentication succeeded but returned invalid user data.');
      }
      // Always wipe cached data from any prior user session before entering the new workspace
      await cacheManager.clearAll().catch(() => {});
      requestRateLimiter.reset();
      const resolvedRole = resolveActivePortalRole(res.user, roleHint ?? res.user.sessionRole);
      const sessionUser: PublicUser = { ...res.user, sessionRole: resolvedRole };
      await tokenStorage.setToken(res.token);
      await tokenStorage.setSessionRole(resolvedRole);
      await tokenStorage.setCachedUser(sessionUser);
      setToken(res.token);
      setSessionRoleState(resolvedRole);
      setUser(sessionUser);
      syncMockServiceUser(sessionUser);
      setAuthState('AUTHENTICATED');
      return { ...res, user: sessionUser };
    } finally {
      setIsActionLoading(false);
    }
  }

  async function logout(specificUserId?: string) {
    setIsActionLoading(true);
    try {
      const idToClear = specificUserId || user?.id;
      if (idToClear) {
        try {
          await draftStorage.clearUserStorage(idToClear);
        } catch (storageErr) {
          console.warn('Failed to clear user draft storage on logout:', storageErr);
        }
      }
      await cacheManager.clearAll().catch(() => {});
      requestRateLimiter.reset();
      await tokenStorage.clearToken();
      setToken(null);
      setUser(null);
      setSessionRoleState(null);
      setAuthState('UNAUTHENTICATED');
    } finally {
      setIsActionLoading(false);
    }
  }

  async function refreshUser(): Promise<PublicUser | null> {
    try {
      const [res, storedSessionRole] = await Promise.all([
        authApi.me(),
        tokenStorage.getSessionRole(),
      ]);
      if (res && res.user) {
        const resolvedRole = resolveActivePortalRole(
          res.user,
          res.user.sessionRole ?? sessionRole ?? storedSessionRole
        );
        const sessionUser: PublicUser = { ...res.user, sessionRole: resolvedRole };
        setUser(sessionUser);
        setSessionRoleState(resolvedRole);
        await tokenStorage.setSessionRole(resolvedRole);
        await tokenStorage.setCachedUser(sessionUser);
        syncMockServiceUser(sessionUser);
        setAuthState('AUTHENTICATED');
        return sessionUser;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function updateProfile(updates: Partial<PublicUser>): Promise<PublicUser> {
    if (!user) throw new Error('No active user session to update');
    const mergedUser: PublicUser = {
      ...user,
      ...updates,
      id: user.id,
      role: user.role,
      sessionRole: sessionRole ?? user.sessionRole,
    };
    try {
      const res = await authApi.updateProfile(updates);
      const finalUser = res?.user
        ? { ...mergedUser, ...res.user, sessionRole: sessionRole ?? res.user.sessionRole ?? user.sessionRole }
        : mergedUser;
      setUser(finalUser);
      await tokenStorage.setCachedUser(finalUser);
      syncMockServiceUser(finalUser);
      return finalUser;
    } catch (err: any) {
      console.warn('[AuthContext] Remote profile update failed, applying optimistic update:', err);
      setUser(mergedUser);
      await tokenStorage.setCachedUser(mergedUser);
      syncMockServiceUser(mergedUser);
      return mergedUser;
    }
  }

  const role = sessionRole ?? user?.sessionRole ?? user?.role ?? null;
  const isLoading = state === 'INITIALIZING' || isActionLoading;
  const isOffline = state === 'OFFLINE_AUTHENTICATED';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        state,
        isLoading,
        isOffline,
        login,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
