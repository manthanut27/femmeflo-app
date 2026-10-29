import { apiRequest } from './client';
import type { LoginPayload, LoginResponseData, PublicUser } from './types';

export const authApi = {
  /**
   * Unified login with role context
   */
  async login(payload: LoginPayload, roleHint?: 'admin' | 'manager' | 'seller'): Promise<LoginResponseData> {
    const endpoint = roleHint ? `${roleHint}/auth/login` : 'auth/login';
    return apiRequest<LoginResponseData>(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  /**
   * Fetch current authenticated user record
   */
  async me(): Promise<{ user: PublicUser }> {
    return apiRequest<{ user: PublicUser }>('auth/me', {
      method: 'GET',
    });
  },

  /**
   * Change current user's password
   */
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>('auth/password', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Request password recovery instructions
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>('auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },

  /**
   * Reset password with valid token
   */
  async resetPassword(payload: { token: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>('auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  /**
   * Backend health check
   */
  async health(): Promise<{ status: string; database: string }> {
    return apiRequest<{ status: string; database: string }>('health', {
      method: 'GET',
      skipAuth: true,
      timeoutMs: 15000,
    });
  },
};
