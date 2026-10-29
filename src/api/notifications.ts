import { apiRequest } from './client';
import type { NotificationItem } from './types';

export const notificationsApi = {
  async listNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    const raw = await apiRequest<{ notifications?: NotificationItem[]; items?: NotificationItem[]; unreadCount?: number }>('notifications', {
      method: 'GET',
    });
    const items = raw?.notifications ?? raw?.items ?? [];
    const unreadCount = raw?.unreadCount ?? items.filter((n) => !n.read).length;
    return { items, unreadCount };
  },

  async markAsRead(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllAsRead(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>('notifications/read-all', {
      method: 'POST',
    });
  },
};
