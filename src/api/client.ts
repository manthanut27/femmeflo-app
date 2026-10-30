import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { handleMockRequest } from './mockService';
import { ApiError, type PublicUser, type RequestOptions } from './types';

export { ApiError, type RequestOptions };

// Determine Base URL (defaults to local inventory server on port 5000)
const rawApiUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
).trim().replace(/\/+$/, '');

function resolveApiBaseUrl(url: string): string {
  const withApi = url.endsWith('/api/v1') ? url : `${url}/api/v1`;
  // In Android emulator, localhost/127.0.0.1 refers to the device itself; map to host machine 10.0.2.2
  if (Platform.OS === 'android') {
    if (withApi.includes('://localhost')) {
      return withApi.replace('://localhost', '://10.0.2.2');
    }
    if (withApi.includes('://127.0.0.1')) {
      return withApi.replace('://127.0.0.1', '://10.0.2.2');
    }
  }
  return withApi;
}

export const API_BASE_URL = resolveApiBaseUrl(rawApiUrl);

const TOKEN_KEY = 'femmeflo_mobile_auth_token';
const USER_KEY = 'femmeflo_mobile_auth_user';

// Native Secure Storage
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
    } catch (err) {
      console.warn('Failed to clear auth token', err);
    }
  },

  async getCachedUser(): Promise<PublicUser | null> {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  async setCachedUser(user: PublicUser): Promise<void> {
    try {
      const data = JSON.stringify(user);
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(USER_KEY, data);
      } else {
        await SecureStore.setItemAsync(USER_KEY, data);
      }
    } catch (err) {
      console.warn('Failed to cache user record', err);
    }
  },
};

let onSessionExpiredCallback: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpiredCallback = handler;
}

let mockModeEnabled = process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false';

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

  const { params, skipAuth = false, timeoutMs = 45000, headers: customHeaders, ...rest } = options;

  let url = `${API_BASE_URL}/${endpoint.replace(/^\/+/, '')}`;

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
  headers.set('Accept', 'application/json');

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

    if (
      error.name === 'AbortError' ||
      error.message?.includes('Network request failed') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('ECONNREFUSED')
    ) {
      console.warn(`[Client] Backend unavailable (${error.message || 'offline'}). Serving request '${endpoint}' from frontend mock engine.`);
      return handleMockRequest<T>(endpoint, options);
    }

    throw new ApiError(
      error.message || 'Network request failed. Please check your internet connection.',
      0,
      null,
      true
    );
  }
}
