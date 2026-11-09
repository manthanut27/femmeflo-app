/**
 * FemmeFlo Client-Side Rate Limiter
 *
 * Implements a sliding-window rate limiting algorithm to prevent request bursts,
 * excessive polling, rapid double-submits, and API flooding on mobile networks.
 */

export interface RateLimitConfig {
  maxRequests: number; // Maximum allowed requests in the time window
  windowMs: number;    // Sliding window duration in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
  category: string;
}

// Default categorized rate limits
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Global overall requests: 120 requests per minute
  global: { maxRequests: 120, windowMs: 60 * 1000 },
  // Auth operations (login, password reset): 10 requests per minute
  auth: { maxRequests: 10, windowMs: 60 * 1000 },
  // Financial/inventory mutations (POST, PUT, PATCH, DELETE): 30 requests per minute
  mutation: { maxRequests: 30, windowMs: 60 * 1000 },
  // Read operations (GET): 90 requests per minute
  read: { maxRequests: 90, windowMs: 60 * 1000 },
  // Search / geocoding lookup: 40 requests per minute
  search: { maxRequests: 40, windowMs: 60 * 1000 },
};

export class RequestRateLimiter {
  private requestLogs: Map<string, number[]> = new Map();
  private customConfigs: Map<string, RateLimitConfig> = new Map();
  private serverLockouts: Map<string, number> = new Map(); // Key -> expiry timestamp

  /**
   * Categorizes an API endpoint and method into a rate-limit category.
   */
  public getCategory(endpoint: string, method = 'GET'): string {
    const cleanEndpoint = endpoint.replace(/^\/+/, '').toLowerCase();
    const upperMethod = method.toUpperCase();

    if (cleanEndpoint.startsWith('auth/') || cleanEndpoint === 'auth') {
      return 'auth';
    }

    if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
      return 'mutation';
    }

    if (cleanEndpoint.includes('search') || cleanEndpoint.includes('pincode') || cleanEndpoint.includes('geocode')) {
      return 'search';
    }

    return 'read';
  }

  /**
   * Configures a custom rate limit for a specific category or endpoint key.
   */
  public setConfig(key: string, config: RateLimitConfig): void {
    this.customConfigs.set(key, config);
  }

  /**
   * Gets the applicable rate limit config for a given category.
   */
  public getConfig(category: string): RateLimitConfig {
    return this.customConfigs.get(category) || DEFAULT_RATE_LIMITS[category] || DEFAULT_RATE_LIMITS.global;
  }

  /**
   * Checks whether a request under the given key/category is permitted.
   */
  public checkLimit(key: string, categoryOverride?: string): RateLimitResult {
    const now = Date.now();
    const category = categoryOverride || this.getCategory(key);
    const config = this.getConfig(category);

    // 1. Check if an active server 429 lockout exists
    const serverLockoutExpiry = this.serverLockouts.get(key) || this.serverLockouts.get(category);
    if (serverLockoutExpiry && serverLockoutExpiry > now) {
      const retryAfterSeconds = Math.ceil((serverLockoutExpiry - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetMs: serverLockoutExpiry - now,
        retryAfterSeconds,
        category,
      };
    }

    // 2. Sliding window check
    const timestamps = this.requestLogs.get(key) || [];
    const windowStart = now - config.windowMs;

    // Filter out expired timestamps
    const validTimestamps = timestamps.filter((t) => t > windowStart);
    this.requestLogs.set(key, validTimestamps);

    if (validTimestamps.length >= config.maxRequests) {
      const oldestValid = validTimestamps[0];
      const resetMs = Math.max(0, oldestValid + config.windowMs - now);
      const retryAfterSeconds = Math.ceil(resetMs / 1000) || 1;

      return {
        allowed: false,
        remaining: 0,
        resetMs,
        retryAfterSeconds,
        category,
      };
    }

    const remaining = config.maxRequests - validTimestamps.length;
    return {
      allowed: true,
      remaining,
      resetMs: config.windowMs,
      retryAfterSeconds: 0,
      category,
    };
  }

  /**
   * Records a dispatched request under the given key.
   */
  public recordRequest(key: string): void {
    const now = Date.now();
    const timestamps = this.requestLogs.get(key) || [];
    timestamps.push(now);
    this.requestLogs.set(key, timestamps);
  }

  /**
   * Enforces a temporary lockout (e.g. from a backend HTTP 429 Retry-After response).
   */
  public setLockout(key: string, durationSeconds: number): void {
    const expiry = Date.now() + Math.max(1, durationSeconds) * 1000;
    this.serverLockouts.set(key, expiry);
  }

  /**
   * Resets rate-limit history for a key, or all keys if omitted.
   */
  public reset(key?: string): void {
    if (key) {
      this.requestLogs.delete(key);
      this.serverLockouts.delete(key);
    } else {
      this.requestLogs.clear();
      this.serverLockouts.clear();
    }
  }

  /**
   * Returns current statistics for debugging and tests.
   */
  public getStats(key: string): { count: number; category: string } {
    const category = this.getCategory(key);
    const timestamps = this.requestLogs.get(key) || [];
    return { count: timestamps.length, category };
  }
}

export const requestRateLimiter = new RequestRateLimiter();
