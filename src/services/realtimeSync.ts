import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
import { getApiBaseUrl, tokenStorage } from '../api/client';
import { cacheManager } from '../utils/cacheManager';

export type RealtimeEventType =
  | 'INVENTORY_UPDATE'
  | 'SALE_STATUS_UPDATE'
  | 'APPROVAL_UPDATE'
  | 'SHIFT_UPDATE'
  | 'CUSTOMER_UPDATE'
  | 'HEARTBEAT';

export interface RealtimeEventPayload {
  id: string;
  type: RealtimeEventType;
  timestamp: number;
  actorId?: string;
  role?: string;
  entityId?: string;
  action?: string;
  data?: Record<string, unknown>;
}

export type RealtimeConnectionState = 'connected' | 'reconnecting' | 'offline';

class MobileRealtimeSyncService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = Date.now() - 30000;
  private isPolling = false;
  private isRunning = false;
  private wasOffline = false;
  private connectionState: RealtimeConnectionState = 'offline';
  private seenEventIds = new Set<string>();
  private appStateSubscription: { remove: () => void } | null = null;

  public getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.connectionState = 'reconnecting';

    // Poll every 10 seconds when foregrounded to avoid triggering server rate limits
    this.pollTimer = setInterval(() => {
      if (AppState.currentState && AppState.currentState !== 'active') return;
      this.pollUpdates();
    }, 10000);

    // Initial sync
    this.pollUpdates();

    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        this.pollUpdates();
      }
    });
  }

  public stop(): void {
    this.isRunning = false;
    this.connectionState = 'offline';
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.seenEventIds.clear();
  }

  public async pollUpdates(): Promise<void> {
    if (this.isPolling || !this.isRunning) return;
    try {
      const token = await tokenStorage.getToken();
      if (!token) return;

      this.isPolling = true;
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/realtime/poll?since=${this.lastPollTimestamp}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (this.connectionState === 'connected') {
          this.wasOffline = true;
          this.connectionState = 'reconnecting';
        }
        return;
      }

      const json = await res.json();
      const events: RealtimeEventPayload[] = json?.data?.events ?? [];
      const serverTime: number = json?.data?.serverTime ?? Date.now();

      if (this.wasOffline) {
        this.wasOffline = false;
        DeviceEventEmitter.emit('REALTIME_RECONNECTED', { timestamp: serverTime });
      }
      this.connectionState = 'connected';
      this.lastPollTimestamp = Math.max(this.lastPollTimestamp, serverTime);

      if (events.length > 0) {
        const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
        for (const evt of sorted) {
          this.handleEvent(evt);
        }
      }
    } catch {
      if (this.connectionState === 'connected') {
        this.wasOffline = true;
      }
      this.connectionState = 'offline';
    } finally {
      this.isPolling = false;
    }
  }

  public handleEvent(evt: RealtimeEventPayload): void {
    if (!evt || !evt.id) return;
    if (this.seenEventIds.has(evt.id)) return;

    this.seenEventIds.add(evt.id);
    if (this.seenEventIds.size > 200) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) this.seenEventIds.delete(oldest);
    }

    // Emit canonical event name matching backend RealtimeEventType
    DeviceEventEmitter.emit(evt.type, evt);

    switch (evt.type) {
      case 'INVENTORY_UPDATE':
        cacheManager.invalidateByTags(['inventory', 'dashboard']).catch(() => {});
        DeviceEventEmitter.emit('INVENTORY_SYNC', evt);
        DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', evt);
        DeviceEventEmitter.emit('REALTIME_DATA_SYNC', evt);
        break;

      case 'SALE_STATUS_UPDATE':
      case 'APPROVAL_UPDATE':
        cacheManager.invalidateByTags(['sales', 'inventory', 'dashboard']).catch(() => {});
        DeviceEventEmitter.emit('SALES_SYNC', evt);
        DeviceEventEmitter.emit('APPROVAL_STATUS_CHANGED', evt);
        DeviceEventEmitter.emit('INVENTORY_SYNC', evt);
        DeviceEventEmitter.emit('REALTIME_DATA_SYNC', evt);
        break;

      case 'SHIFT_UPDATE':
        cacheManager.invalidateByTags(['shifts', 'dashboard']).catch(() => {});
        DeviceEventEmitter.emit('SHIFT_SYNC', evt);
        DeviceEventEmitter.emit('REALTIME_DATA_SYNC', evt);
        break;

      case 'CUSTOMER_UPDATE':
        cacheManager.invalidateByTags(['customers', 'dashboard']).catch(() => {});
        DeviceEventEmitter.emit('CUSTOMER_SYNC', evt);
        DeviceEventEmitter.emit('REALTIME_DATA_SYNC', evt);
        break;

      default:
        DeviceEventEmitter.emit('REALTIME_DATA_SYNC', evt);
        break;
    }
  }
}

export const mobileRealtimeSync = new MobileRealtimeSyncService();
