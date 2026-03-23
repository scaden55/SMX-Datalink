import { create } from 'zustand';
import { api } from '../lib/api';
import type { Notification, NotificationListResponse } from '@acars/shared';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;

  fetch: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.get<NotificationListResponse>('/api/notifications');
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  markRead: async (id: number) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {
      // Silently ignore — notification will remain unread in UI
    }
  },

  markAllRead: async () => {
    try {
      await api.post('/api/notifications/read-all');
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently ignore — notifications will remain unread in UI
    }
  },
}));
