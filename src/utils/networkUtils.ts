import { API_BASE_URL } from '@/api/client';

export type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkStatusMonitor {
  private isOnline = true;
  private listeners: Set<NetworkStatusListener> = new Set();
  private checkInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine ?? true;
      window.addEventListener('online', () => this.updateStatus(true));
      window.addEventListener('offline', () => this.updateStatus(false));
    }
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateStatus(newStatus: boolean) {
    if (this.isOnline !== newStatus) {
      this.isOnline = newStatus;
      this.listeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.warn('[networkUtils] Listener error', e);
        }
      });
    }
  }

  /**
   * Performs an active health check ping against the server.
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const url = `${API_BASE_URL}/health`;

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);

      const status = res.status < 500;
      this.updateStatus(status);
      return status;
    } catch {
      this.updateStatus(false);
      return false;
    }
  }
}

export const networkMonitor = new NetworkStatusMonitor();
