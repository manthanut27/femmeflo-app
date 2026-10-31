import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { setSessionExpiredHandler, tokenStorage } from '../api/client';
import { syncMockServiceUser } from '../api/mockService';
import type { AuthRole, PublicUser } from '../api/types';
import { draftStorage } from '../utils/draftStorage';

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
  logout: () => Promise<void>;
  refreshUser: () => Promise<PublicUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setAuthState] = useState<AuthState>('INITIALIZING');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  async function restoreSession() {
    try {
      setAuthState('INITIALIZING');
      setIsActionLoading(true);

      const storedToken = await tokenStorage.getToken();
      if (!storedToken) {
        setToken(null);
        setUser(null);
        setAuthState('UNAUTHENTICATED');
        return;
      }

      // Purge any legacy mock test tokens from storage
      if (storedToken.startsWith('mock_jwt_token_')) {
        await tokenStorage.clearToken();
        setToken(null);
        setUser(null);
        setAuthState('UNAUTHENTICATED');
        return;
      }

      setToken(storedToken);

      // Verify token with live backend
      try {
        const res = await authApi.me();
        if (res && res.user && res.user.id && res.user.role) {
          setUser(res.user);
          await tokenStorage.setCachedUser(res.user);
          syncMockServiceUser(res.user);
          setAuthState('AUTHENTICATED');
        } else {
          await tokenStorage.clearToken();
          setToken(null);
          setUser(null);
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
          setToken(null);
          setUser(null);
          setAuthState('SESSION_EXPIRED');
        } else if (isNetworkErr || statusCode >= 500) {
          // Network failure, timeout, host unreachable, or temporary 5xx gateway error
          // Restore previously authenticated profile from cache without changing user role
          const cached = await tokenStorage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_')) {
            console.info(`[AuthContext] Backend unreachable. Restoring cached session for ${cached.role} (${cached.email || cached.name}).`);
            setUser(cached);
            syncMockServiceUser(cached);
            setAuthState('OFFLINE_AUTHENTICATED');
          } else {
            // No valid cached user to restore
            console.warn('[AuthContext] Network unreachable and no valid cached profile found.');
            await tokenStorage.clearToken();
            setToken(null);
            setUser(null);
            setAuthState('UNAUTHENTICATED');
          }
        } else {
          // Other unexpected error (e.g. malformed response)
          const cached = await tokenStorage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_')) {
            setUser(cached);
            syncMockServiceUser(cached);
            setAuthState('OFFLINE_AUTHENTICATED');
          } else {
            await tokenStorage.clearToken();
            setToken(null);
            setUser(null);
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
      setUser(null);
      setToken(null);
      setAuthState('SESSION_EXPIRED');
    });

    restoreSession();
  }, []);

  async function login(identifier: string, password: string, roleHint?: 'admin' | 'manager' | 'seller') {
    setIsActionLoading(true);
    try {
      const res = await authApi.login({ identifier, password, roleHint });
      if (!res.user || !res.user.role || !res.token) {
        throw new Error('Authentication succeeded but returned invalid user data.');
      }
      await tokenStorage.setToken(res.token);
      await tokenStorage.setCachedUser(res.user);
      setToken(res.token);
      setUser(res.user);
      syncMockServiceUser(res.user);
      setAuthState('AUTHENTICATED');
      return res;
    } finally {
      setIsActionLoading(false);
    }
  }

  async function logout() {
    setIsActionLoading(true);
    try {
      if (user?.id) {
        try {
          await draftStorage.clearUserStorage(user.id);
        } catch (storageErr) {
          console.warn('Failed to clear user draft storage on logout:', storageErr);
        }
      }
      await tokenStorage.clearToken();
      setToken(null);
      setUser(null);
      setAuthState('UNAUTHENTICATED');
    } finally {
      setIsActionLoading(false);
    }
  }

  async function refreshUser(): Promise<PublicUser | null> {
    try {
      const res = await authApi.me();
      if (res && res.user) {
        setUser(res.user);
        await tokenStorage.setCachedUser(res.user);
        syncMockServiceUser(res.user);
        setAuthState('AUTHENTICATED');
        return res.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  const role = user?.role ?? null;
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
