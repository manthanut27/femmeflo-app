/**
 * FemmeFlo Login Attempt Limiter & Brute-Force Protection Engine
 *
 * Tracks failed authentication attempts per user/identifier, enforces escalating
 * temporary lockouts, and persists state across app restarts via AsyncStorage.
 */

import { resolveDefaultStorage, type StorageBackend } from './draftStorage.ts';

export interface LoginAttemptState {
  failedAttempts: number;
  lastFailedTimestamp: number;
  lockoutExpiresAt: number | null;
  lockoutCount: number; // How many times user was locked out
}

export interface LoginAttemptStatus {
  isLocked: boolean;
  failedAttempts: number;
  remainingAttempts: number;
  lockoutRemainingSeconds: number;
  lockoutExpiresAt: number | null;
  warningMessage: string | null;
}

export interface LoginLimiterConfig {
  maxAttempts: number;
  initialLockoutSeconds: number;
  escalatedLockoutSeconds: number;
  attemptWindowMs: number; // Time after which inactive failed attempts expire
}

export const DEFAULT_LOGIN_LIMITER_CONFIG: LoginLimiterConfig = {
  maxAttempts: 5,                  // Lock out after 5 consecutive failed attempts
  initialLockoutSeconds: 60,       // 1 minute first lockout
  escalatedLockoutSeconds: 300,    // 5 minutes subsequent lockout
  attemptWindowMs: 15 * 60 * 1000, // 15 minutes window
};

export class LoginAttemptLimiter {
  private storage: StorageBackend;
  private config: LoginLimiterConfig;
  private inMemoryCache: Map<string, LoginAttemptState> = new Map();

  constructor(storage?: StorageBackend, config?: Partial<LoginLimiterConfig>) {
    this.storage = storage || resolveDefaultStorage();
    this.config = { ...DEFAULT_LOGIN_LIMITER_CONFIG, ...config };
  }

  private getStorageKey(identifier: string): string {
    const cleanId = identifier.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    return `@femmeflo_login_lockout_${cleanId}`;
  }

  /**
   * Retrieves the current persisted login state for an identifier.
   */
  private async getState(identifier: string): Promise<LoginAttemptState> {
    const key = this.getStorageKey(identifier);

    // 1. Check memory cache first
    const memory = this.inMemoryCache.get(key);
    if (memory) {
      return memory;
    }

    // 2. Check storage
    try {
      const raw = await this.storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.inMemoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Fallback
    }

    const defaultState: LoginAttemptState = {
      failedAttempts: 0,
      lastFailedTimestamp: 0,
      lockoutExpiresAt: null,
      lockoutCount: 0,
    };
    return defaultState;
  }

  /**
   * Saves updated login state to storage and memory.
   */
  private async saveState(identifier: string, state: LoginAttemptState): Promise<void> {
    const key = this.getStorageKey(identifier);
    this.inMemoryCache.set(key, state);
    try {
      await this.storage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to persist login lockout state', err);
    }
  }

  /**
   * Checks the current lockout status for an identifier without incrementing attempts.
   */
  public async getStatus(identifier: string): Promise<LoginAttemptStatus> {
    if (!identifier || !identifier.trim()) {
      return {
        isLocked: false,
        failedAttempts: 0,
        remainingAttempts: this.config.maxAttempts,
        lockoutRemainingSeconds: 0,
        lockoutExpiresAt: null,
        warningMessage: null,
      };
    }

    const state = await this.getState(identifier);
    const now = Date.now();

    // Check if lockout has expired
    if (state.lockoutExpiresAt && state.lockoutExpiresAt <= now) {
      // Lockout window has passed, reset failed attempts
      state.lockoutExpiresAt = null;
      state.failedAttempts = 0;
      await this.saveState(identifier, state);
    }

    // Check if old failed attempts have expired
    if (!state.lockoutExpiresAt && state.lastFailedTimestamp && now - state.lastFailedTimestamp > this.config.attemptWindowMs) {
      state.failedAttempts = 0;
      await this.saveState(identifier, state);
    }

    const isLocked = Boolean(state.lockoutExpiresAt && state.lockoutExpiresAt > now);
    const lockoutRemainingSeconds = isLocked ? Math.ceil((state.lockoutExpiresAt! - now) / 1000) : 0;
    const remainingAttempts = Math.max(0, this.config.maxAttempts - state.failedAttempts);

    let warningMessage: string | null = null;
    if (isLocked) {
      warningMessage = `Account locked due to too many failed attempts. Try again in ${lockoutRemainingSeconds}s.`;
    } else if (state.failedAttempts > 0 && remainingAttempts <= 2) {
      warningMessage = `Incorrect credentials. ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining before temporary lockout.`;
    }

    return {
      isLocked,
      failedAttempts: state.failedAttempts,
      remainingAttempts,
      lockoutRemainingSeconds,
      lockoutExpiresAt: state.lockoutExpiresAt,
      warningMessage,
    };
  }

  /**
   * Records a failed login attempt for the identifier.
   * If failed attempts reach the threshold, initiates a lockout period.
   */
  public async recordFailedAttempt(identifier: string): Promise<LoginAttemptStatus> {
    if (!identifier || !identifier.trim()) {
      return this.getStatus(identifier);
    }

    const state = await this.getState(identifier);
    const now = Date.now();

    state.failedAttempts += 1;
    state.lastFailedTimestamp = now;

    // Check if threshold reached
    if (state.failedAttempts >= this.config.maxAttempts) {
      state.lockoutCount += 1;
      const lockoutDurationSeconds =
        state.lockoutCount > 1
          ? this.config.escalatedLockoutSeconds
          : this.config.initialLockoutSeconds;

      state.lockoutExpiresAt = now + lockoutDurationSeconds * 1000;
    }

    await this.saveState(identifier, state);
    return this.getStatus(identifier);
  }

  /**
   * Clears failed attempt counters and active lockout on successful authentication.
   */
  public async recordSuccessfulLogin(identifier: string): Promise<void> {
    if (!identifier || !identifier.trim()) return;
    const key = this.getStorageKey(identifier);
    this.inMemoryCache.delete(key);
    try {
      await this.storage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  /**
   * Manually resets attempts (e.g. for testing or administrative unlock).
   */
  public async reset(identifier?: string): Promise<void> {
    if (identifier) {
      await this.recordSuccessfulLogin(identifier);
    } else {
      this.inMemoryCache.clear();
    }
  }
}

export const loginAttemptLimiter = new LoginAttemptLimiter();
