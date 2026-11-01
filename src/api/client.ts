import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { handleMockRequest } from './mockService';
import { ApiError, type PublicUser } from './types';

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  timeoutMs?: number;
  responseType?: 'json' | 'blob' | 'text' | 'arrayBuffer';
  retries?: number;
}

export { ApiError };

// Primary Render Production Backend URL
export const RENDER_BACKEND_API_URL = 'https://femmeflo-inventory.onrender.com/api/v1';
export const DEFAULT_PRODUCTION_API_URL = RENDER_BACKEND_API_URL;

const rawApiUrl = (
  process.env.EXPO_PUBLIC_API_URL || RENDER_BACKEND_API_URL
).trim().replace(/\/+$/, '');

let customApiBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (customApiBaseUrl) return customApiBaseUrl;
  return resolveApiBaseUrl(rawApiUrl);
}

export function setCustomApiBaseUrl(url: string | null): void {
  if (!url) {
    customApiBaseUrl = null;
    return;
  }
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.endsWith('/api/v1')) {
    clean += '/api/v1';
  }
  customApiBaseUrl = clean;
}

function resolveApiBaseUrl(url?: string | null): string {
  if (!url || !url.trim()) {
    return RENDER_BACKEND_API_URL;
  }
  const clean = url.trim().replace(/\/+$/, '');
  return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl(rawApiUrl);

export async function testBackendHealth(targetUrl?: string): Promise<{ ok: boolean; status: string; url: string }> {
  const currentBase = targetUrl || getApiBaseUrl();
  const healthUrl = `${currentBase.replace(/\/+$/, '')}/health`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return { ok: true, status: 'Connected to live backend', url: currentBase };
    }
    return { ok: false, status: `HTTP ${res.status} from server`, url: currentBase };
  } catch (err: any) {
    return { ok: false, status: err.message || 'Host unreachable', url: currentBase };
  }
}

const TOKEN_KEY = 'femmeflo_mobile_auth_token';
const USER_KEY = 'femmeflo_mobile_auth_user';

function getAsyncStorageBackend() {
  if (Platform.OS === 'web') {
    return {
      async getItem(key: string) { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; },
      async setItem(key: string, val: string) { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val); },
      async removeItem(key: string) { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); },
    };
  }
  try {
    const mod = require('@react-native-async-storage/async-storage');
    const asyncStorage = mod?.default ?? mod;
    if (asyncStorage && typeof asyncStorage.getItem === 'function') {
      return asyncStorage;
    }
  } catch {
    // In-memory or native fallback
  }
  const memoryStore = new Map<string, string>();
  return {
    async getItem(key: string) { return memoryStore.get(key) ?? null; },
    async setItem(key: string, val: string) { memoryStore.set(key, val); },
    async removeItem(key: string) { memoryStore.delete(key); },
  };
}

const asyncProfileBackend = getAsyncStorageBackend();

/**
 * Non-sensitive profile storage using AsyncStorage.
 * Keeps user metadata separate from sensitive tokens in SecureStore.
 */
export const userProfileStorage = {
  async getCachedUser(): Promise<PublicUser | null> {
    try {
      const raw = await asyncProfileBackend.getItem(USER_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        if (user && typeof user === 'object' && user.id && user.role) {
          return user;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async setCachedUser(user: PublicUser): Promise<void> {
    try {
      if (!user || !user.id || !user.role) return;
      await asyncProfileBackend.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Failed to cache user profile in AsyncStorage', err);
    }
  },

  async clearCachedUser(): Promise<void> {
    try {
      await asyncProfileBackend.removeItem(USER_KEY);
    } catch (err) {
      console.warn('Failed to clear cached user profile', err);
    }
  },
};

// Native Secure Storage for authentication tokens
export const tokenStorage = {
  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (err) {
      console.warn('Failed to store auth token securely', err);
    }
  },

  async clearToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
      }
      await userProfileStorage.clearCachedUser();
    } catch (err) {
      console.warn('Failed to clear auth token', err);
    }
  },

  async getCachedUser(): Promise<PublicUser | null> {
    // 1. Check separate non-sensitive profile storage (AsyncStorage)
    const profile = await userProfileStorage.getCachedUser();
    if (profile && profile.id && profile.role) return profile;

    // 2. Fall back to SecureStore migration check
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      if (raw) {
        const legacyUser = JSON.parse(raw);
        if (legacyUser && legacyUser.id && legacyUser.role) {
          await userProfileStorage.setCachedUser(legacyUser);
          return legacyUser;
        }
      }
    } catch {
      // ignore
    }
    return null;
  },

  async setCachedUser(user: PublicUser): Promise<void> {
    await userProfileStorage.setCachedUser(user);
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      }
    } catch {
      // ignore SecureStore size limit if thrown
    }
  },
};

let onSessionExpiredCallback: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpiredCallback = handler;
}

let mockModeEnabled = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';

export function isMockMode(): boolean {
  return mockModeEnabled;
}

export function setMockMode(enabled: boolean): void {
  mockModeEnabled = enabled;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  if (mockModeEnabled) {
    return handleMockRequest<T>(endpoint, options);
  }

  const {
    params,
    skipAuth = false,
    timeoutMs = 8000,
    headers: customHeaders,
    responseType,
    retries = 0,
    ...rest
  } = options;

  let url = `${getApiBaseUrl()}/${endpoint.replace(/^\/+/, '')}`;

  if (params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    if (qStr) {
      url += (url.includes('?') ? '&' : '?') + qStr;
    }
  }

  const headers = new Headers(customHeaders);
  if (responseType === 'blob' || responseType === 'arrayBuffer') {
    headers.set('Accept', 'application/pdf, application/octet-stream, */*');
  } else {
    headers.set('Accept', 'application/json');
  }

  if (!skipAuth) {
    const token = await tokenStorage.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const isFormData = typeof FormData !== 'undefined' && rest.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const method = (rest.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  let attempts = 0;
  const maxAttempts = isIdempotent ? Math.max(1, 1 + retries) : 1;

  while (attempts < maxAttempts) {
    attempts++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...rest,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 401 && !skipAuth) {
        await tokenStorage.clearToken();
        if (onSessionExpiredCallback) {
          onSessionExpiredCallback();
        }
        throw new ApiError('Your session has expired. Please sign in again.', 401);
      }

      const contentType = response.headers.get('content-type') || '';
      let responseData: any = null;

      if (responseType === 'blob' || (!responseType && (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')))) {
        responseData = await response.blob();
        if (!response.ok) {
          throw new ApiError(`Server returned status ${response.status}`, response.status);
        }
        return responseData as T;
      }

      if (responseType === 'arrayBuffer') {
        responseData = await response.arrayBuffer();
        if (!response.ok) {
          throw new ApiError(`Server returned status ${response.status}`, response.status);
        }
        return responseData as T;
      }

      if (responseType === 'text') {
        responseData = await response.text();
        if (!response.ok) {
          throw new ApiError(responseData || `Server returned status ${response.status}`, response.status);
        }
        return responseData as T;
      }

      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }

      if (!response.ok) {
        let errorMessage = 'An error occurred while connecting to server.';
        if (responseData && typeof responseData === 'object') {
          errorMessage =
            responseData.message ||
            responseData.error?.message ||
            (typeof responseData.error === 'string' ? responseData.error : null) ||
            `Server returned status ${response.status}`;
        }
        throw new ApiError(errorMessage, response.status, responseData);
      }

      // Support responses structured as { success: true, data: T } or directly T
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        return responseData.data as T;
      }

      return responseData as T;
    } catch (error: any) {
      clearTimeout(timer);

      if (error instanceof ApiError) {
        throw error;
      }

      const errorMsg = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
      const isNetworkOrAbort =
        error.name === 'AbortError' ||
        errorMsg.includes('network request failed') ||
        errorMsg.includes('failed to fetch') ||
        errorMsg.includes('fetch failed') ||
        errorMsg.includes('noroutetohost') ||
        errorMsg.includes('host unreachable') ||
        errorMsg.includes('connectexception') ||
        errorMsg.includes('sockettimeoutexception') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('networkerror') ||
        errorMsg.includes('failed to connect') ||
        errorMsg.includes('econnrefused') ||
        errorMsg.includes('enetunreach') ||
        errorMsg.includes('ehostunreach');

      if (isNetworkOrAbort && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempts));
        continue;
      }

      if (isNetworkOrAbort) {
        // Critical: Auth endpoints MUST NEVER silently fall back to mock data!
        const cleanEndpoint = endpoint.replace(/^\/+/, '').toLowerCase();
        const isAuthEndpoint =
          cleanEndpoint.startsWith('auth/') ||
          cleanEndpoint === 'auth' ||
          cleanEndpoint.includes('/auth/');
        if (isAuthEndpoint) {
          throw new ApiError(
            `Unable to reach authentication server. Please check your internet connection.`,
            0,
            null,
            true
          );
        }

        console.warn(`[Client] Backend unavailable (${error.message || 'offline'}). Serving request '${endpoint}' from resilient mock engine.`);
        try {
          return await handleMockRequest<T>(endpoint, options);
        } catch (mockErr: any) {
          throw new ApiError(
            `Unable to reach backend server at ${API_BASE_URL} and mock fallback failed: ${mockErr.message}`,
            0,
            null,
            true
          );
        }
      }

      throw new ApiError(
        error.message || 'Network request failed. Please check your internet connection.',
        0,
        null,
        true
      );
    }
  }

  throw new ApiError('Request failed after maximum retry attempts.', 0, null, true);
}
