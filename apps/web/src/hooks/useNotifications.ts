import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification } from '@lanpapp/shared';
import { api } from '../services/api';

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: Record<string, unknown>) => [...notificationKeys.all, 'list', filters] as const,
};

// Fetch notifications
export function useNotifications(filters?: { page?: number; limit?: number; unread_only?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.unread_only) params.set('unread_only', 'true');

      const response = await api.get(`/notifications?${params.toString()}`);
      return response.data.data as {
        notifications: Notification[];
        unread_count: number;
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// Mark notification as read
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch<{ data: Notification }>(`/notifications/${id}/read`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Mark all notifications as read
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Delete notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Subscribe to push notifications
export function useSubscribePush() {
  return useMutation({
    mutationFn: async (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) => {
      const response = await api.post('/notifications/subscribe-push', subscription);
      return response.data.data;
    },
  });
}

// Unsubscribe from push notifications
export function useUnsubscribePush() {
  return useMutation({
    mutationFn: async (endpoint: string) => {
      await api.delete('/notifications/unsubscribe-push', { data: { endpoint } });
    },
  });
}

// Helper hook for push notification setup
export function usePushNotifications() {
  const subscribeMutation = useSubscribePush();

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  const subscribe = async () => {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return null;
    }

    const hasPermission = await requestPermission();
    if (!hasPermission) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // Get the VAPID public key from your server/env
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.warn('VAPID public key not configured');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });

    const json = subscription.toJSON();

    await subscribeMutation.mutateAsync({
      endpoint: json.endpoint!,
      keys: {
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      },
    });

    return subscription;
  };

  return {
    requestPermission,
    subscribe,
    isLoading: subscribeMutation.isPending,
    error: subscribeMutation.error,
  };
}
