import { AppState, type AppStateStatus, DeviceEventEmitter } from 'react-native';
import { getApiBaseUrl, tokenStorage } from '../api/client';
import { cacheManager } from '../utils/cacheManager';

export interface RealtimeEventPayload {
  id: string;
  type:
    | 'INVENTORY_UPDATE'
    | 'SALE_STATUS_UPDATE'
    | 'APPROVAL_UPDATE'
    | 'SHIFT_UPDATE'
    | 'CUSTOMER_UPDATE'
    | 'HEARTBEAT';
  timestamp: number;
  actorId?: string;
  role?: string;
  entityId?: string;
  action?: string;
  data?: Record<string, unknown>;
}

class MobileRealtimeSyncService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPollTimestamp = Date.now() - 30000;
  private isPolling = false;
  private isRunning = false;
  private appStateSubscription: { remove: () => void } | null = null;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Poll every 7 seconds when foregrounded
    this.pollTimer = setInterval(() => {
      this.pollUpdates();
    }, 7000);

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
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  public async pollUpdates(): Promise<void> {
    if (this.isPolling) return;
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

      if (!res.ok) return;
      const json = await res.json();
      const events: RealtimeEventPayload[] = json?.data?.events ?? [];
      const serverTime: number = json?.data?.serverTime ?? Date.now();

      this.lastPollTimestamp = serverTime;

      if (events.length > 0) {
        for (const evt of events) {
          this.handleEvent(evt);
        }
      }
    } catch {
      // Ignore background network blips
    } finally {
      this.isPolling = false;
    }
  }

  public handleEvent(evt: RealtimeEventPayload): void {
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
