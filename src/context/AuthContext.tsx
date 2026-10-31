import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { setSessionExpiredHandler, tokenStorage } from '../api/client';
import type { AuthRole, PublicUser } from '../api/types';
import { draftStorage } from '../utils/draftStorage';

interface AuthContextType {
  user: PublicUser | null;
  token: string | null;
  role: AuthRole | null;
  isLoading: boolean;
  login: (identifier: string, password: string, roleHint?: 'admin' | 'manager' | 'seller') => Promise<{ user: PublicUser; token: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<PublicUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  async function restoreSession() {
    try {
      setIsLoading(true);
      const storedToken = await tokenStorage.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Purge any legacy mock test tokens from storage
      if (storedToken.startsWith('mock_jwt_token_')) {
        await tokenStorage.clearToken();
        setToken(null);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      // Verify token with live backend
      try {
        const res = await authApi.me();
        if (res && res.user && res.user.id && res.user.role) {
          setUser(res.user);
          await tokenStorage.setCachedUser(res.user);
        } else {
          await tokenStorage.clearToken();
          setToken(null);
          setUser(null);
        }
      } catch (err: any) {
        // If server explicitly rejected token (401 Unauthorized or 403 Forbidden), do NOT restore cached user
        const statusCode = err?.statusCode ?? err?.status;
        if (statusCode === 401 || statusCode === 403) {
          await tokenStorage.clearToken();
          setToken(null);
          setUser(null);
        } else {
          // Pure network / offline error: allow offline session restoration from cache
          // ONLY if cached user is a genuine backend user record
          const cached = await tokenStorage.getCachedUser();
          if (cached && cached.id && cached.role && !cached.id.startsWith('mock_') && cached.id !== 'usr_seller_01') {
            setUser(cached);
          } else {
            await tokenStorage.clearToken();
            setToken(null);
            setUser(null);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Set up session expiry hook to wipe local state
    setSessionExpiredHandler(() => {
      setUser(null);
      setToken(null);
    });

    restoreSession();
  }, []);

  async function login(identifier: string, password: string, roleHint?: 'admin' | 'manager' | 'seller') {
    setIsLoading(true);
    try {
      const res = await authApi.login({ identifier, password, roleHint });
      await tokenStorage.setToken(res.token);
      await tokenStorage.setCachedUser(res.user);
      setToken(res.token);
      setUser(res.user);
      return res;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshUser(): Promise<PublicUser | null> {
    try {
      const res = await authApi.me();
      if (res && res.user) {
        setUser(res.user);
        await tokenStorage.setCachedUser(res.user);
        return res.user;
      }
      return null;
    } catch {
      return null;
    }
  }

  const role = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isLoading,
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
