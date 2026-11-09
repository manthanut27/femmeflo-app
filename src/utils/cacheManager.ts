/**
 * FemmeFlo Multi-Tier API Caching Engine
 *
 * Implements a dual L1 (In-Memory) + L2 (AsyncStorage Persistent Disk) cache
 * with Time-To-Live (TTL), stale-while-revalidate capability, tag-based cache
 * invalidation on mutations, and transparent offline fallback.
 */

import { resolveDefaultStorage, type StorageBackend } from './draftStorage.ts';

export type CachePolicy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'no-cache';

export interface CacheEntry<T = unknown> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  ttlMs: number;
  tags: string[];
}

export interface CacheOptions {
  ttlMs?: number;
  tags?: string[];
  allowStale?: boolean;
}

// Canonical TTL configurations by domain entity
export const DEFAULT_CACHE_TTLS: Record<string, number> = {
  // Master data changes infrequently: 15 minutes
  products: 15 * 60 * 1000,
  categories: 15 * 60 * 1000,
  warehouses: 15 * 60 * 1000,
  master_data: 15 * 60 * 1000,

  // Customer directories: 5 minutes
  customers: 5 * 60 * 1000,

  // Balances and transactions: 2 minutes
  inventory: 2 * 60 * 1000,
  sales: 2 * 60 * 1000,
  dashboard: 2 * 60 * 1000,
  incentives: 5 * 60 * 1000,

  // Duty shift status: 1 minute
  shifts: 1 * 60 * 1000,

  // Notifications: 1 minute
  notifications: 1 * 60 * 1000,

  // Default fallback TTL: 3 minutes
  default: 3 * 60 * 1000,
};

const STORAGE_PREFIX = '@femmeflo_cache_';
const TAGS_INDEX_KEY = '@femmeflo_cache_tags_index';

export class CacheManager {
  private storage: StorageBackend;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map(); // Tag -> Set of Cache Keys
  private initialized = false;

  constructor(storage?: StorageBackend) {
    this.storage = storage || resolveDefaultStorage();
  }

  /**
   * Initializes tag indexes from disk.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    try {
      const raw = await this.storage.getItem(TAGS_INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [tag, keys] of Object.entries(parsed)) {
          this.tagIndex.set(tag, new Set(keys as string[]));
        }
      }
    } catch {
      // Ignore index load error
    }
    this.initialized = true;
  }

  private async persistTagIndex(): Promise<void> {
    try {
      const serialized: Record<string, string[]> = {};
      for (const [tag, keys] of this.tagIndex.entries()) {
        serialized[tag] = Array.from(keys);
      }
      await this.storage.setItem(TAGS_INDEX_KEY, JSON.stringify(serialized));
    } catch {
      // Ignore
    }
  }

  /**
   * Resolves appropriate cache tags for an endpoint.
   */
  public resolveTagsFromEndpoint(endpoint: string): string[] {
    const clean = endpoint.replace(/^\/+/, '').toLowerCase();
    const tags: string[] = [];

    if (clean.includes('product')) tags.push('products', 'master_data');
    if (clean.includes('categor')) tags.push('categories', 'master_data');
    if (clean.includes('warehouse')) tags.push('warehouses', 'master_data');
    if (clean.includes('customer')) tags.push('customers');
    if (clean.includes('inventor') || clean.includes('stock')) tags.push('inventory');
    if (clean.includes('sale') || clean.includes('invoice') || clean.includes('order')) tags.push('sales');
    if (clean.includes('shift')) tags.push('shifts');
    if (clean.includes('incentive') || clean.includes('payout')) tags.push('incentives');
    if (clean.includes('dashboard')) tags.push('dashboard');
    if (clean.includes('notification')) tags.push('notifications');

    if (tags.length === 0) tags.push('default');
    return tags;
  }

  /**
   * Resolves which cache tags should be invalidated when a mutation succeeds.
   */
  public resolveMutationInvalidationTags(endpoint: string, method = 'POST'): string[] {
    const clean = endpoint.replace(/^\/+/, '').toLowerCase();
    const upperMethod = method.toUpperCase();
    if (upperMethod === 'GET' || upperMethod === 'HEAD') return [];

    const tagsToInvalidate = new Set<string>();

    if (clean.includes('customer')) {
      tagsToInvalidate.add('customers');
      tagsToInvalidate.add('dashboard');
    }

    if (clean.includes('sale') || clean.includes('order')) {
      tagsToInvalidate.add('sales');
      tagsToInvalidate.add('inventory');
      tagsToInvalidate.add('dashboard');
      tagsToInvalidate.add('shifts');
    }

    if (clean.includes('inventor') || clean.includes('transfer') || clean.includes('receipt') || clean.includes('warehouse')) {
      tagsToInvalidate.add('inventory');
      tagsToInvalidate.add('dashboard');
      tagsToInvalidate.add('warehouses');
    }

    if (clean.includes('shift')) {
      tagsToInvalidate.add('shifts');
      tagsToInvalidate.add('dashboard');
    }

    if (clean.includes('incentive') || clean.includes('payout') || clean.includes('rate')) {
      tagsToInvalidate.add('incentives');
      tagsToInvalidate.add('dashboard');
    }

    if (clean.includes('product') || clean.includes('price')) {
      tagsToInvalidate.add('products');
      tagsToInvalidate.add('master_data');
    }

    if (clean.includes('categor')) {
      tagsToInvalidate.add('categories');
      tagsToInvalidate.add('master_data');
    }

    return Array.from(tagsToInvalidate);
  }

  /**
   * Resolves default TTL in milliseconds for the given tags.
   */
  public resolveTtl(tags: string[]): number {
    for (const tag of tags) {
      if (DEFAULT_CACHE_TTLS[tag]) {
        return DEFAULT_CACHE_TTLS[tag];
      }
    }
    return DEFAULT_CACHE_TTLS.default;
  }

  /**
   * Retrieves an entry from cache (L1 memory first, then L2 disk).
   */
  public async get<T>(key: string, options: { allowStale?: boolean } = {}): Promise<CacheEntry<T> | null> {
    await this.ensureInitialized();
    const now = Date.now();

    // 1. Check L1 Memory Cache
    const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      const isFresh = memEntry.expiresAt > now;
      if (isFresh || options.allowStale) {
        return memEntry;
      }
    }

    // 2. Check L2 Disk Cache
    try {
      const raw = await this.storage.getItem(`${STORAGE_PREFIX}${key}`);
      if (raw) {
        const diskEntry = JSON.parse(raw) as CacheEntry<T>;
        // Promote back to L1 Memory
        this.memoryCache.set(key, diskEntry);

        const isFresh = diskEntry.expiresAt > now;
        if (isFresh || options.allowStale) {
          return diskEntry;
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Stores an entry into L1 Memory and L2 Disk storage.
   */
  public async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    await this.ensureInitialized();
    const now = Date.now();
    const tags = options.tags || this.resolveTagsFromEndpoint(key);
    const ttlMs = options.ttlMs || this.resolveTtl(tags);
    const expiresAt = now + ttlMs;

    const entry: CacheEntry<T> = {
      key,
      data,
      createdAt: now,
      expiresAt,
      ttlMs,
      tags,
    };

    // 1. Write to L1 Memory
    this.memoryCache.set(key, entry);

    // 2. Track in Tag Index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }

    // 3. Write to L2 Disk Storage
    try {
      await this.storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
      await this.persistTagIndex();
    } catch (err) {
      console.warn(`[CacheManager] Failed to persist key '${key}' to storage`, err);
    }
  }

  /**
   * Invalidates a specific cache key across L1 and L2.
   */
  public async invalidateKey(key: string): Promise<void> {
    await this.ensureInitialized();
    this.memoryCache.delete(key);

    try {
      await this.storage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch {
      // Ignore
    }

    // Clean from tag indexes
    for (const keys of this.tagIndex.values()) {
      keys.delete(key);
    }
  }

  /**
   * Invalidates all cache entries associated with a specific tag.
   */
  public async invalidateByTag(tag: string): Promise<number> {
    await this.ensureInitialized();
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) return 0;

    let invalidatedCount = 0;
    const keyArray = Array.from(keys);

    for (const key of keyArray) {
      await this.invalidateKey(key);
      invalidatedCount++;
    }

    this.tagIndex.delete(tag);
    await this.persistTagIndex();
    return invalidatedCount;
  }

  /**
   * Invalidates all cache entries matching any of the provided tags.
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    let total = 0;
    for (const tag of tags) {
      total += await this.invalidateByTag(tag);
    }
    return total;
  }

  /**
   * Wipes all cache entries across memory and persistent disk.
   */
  public async clearAll(): Promise<void> {
    await this.ensureInitialized();
    const allKeys: string[] = [];

    for (const keys of this.tagIndex.values()) {
      allKeys.push(...Array.from(keys));
    }

    this.memoryCache.clear();
    this.tagIndex.clear();

    for (const key of allKeys) {
      try {
        await this.storage.removeItem(`${STORAGE_PREFIX}${key}`);
      } catch {
        // Ignore
      }
    }

    try {
      await this.storage.removeItem(TAGS_INDEX_KEY);
    } catch {
      // Ignore
    }
  }
}

export const cacheManager = new CacheManager();
