import type { PushSubscriptionData } from '../types';
import apiClient from './api';

// VAPID 키 캐시 (한 번 가져오면 재사용)
let cachedVapidPublicKey: string | null = null;

// Convert VAPID public key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert PushSubscription to our data format
function subscriptionToData(subscription: PushSubscription): PushSubscriptionData {
  const keys = subscription.toJSON().keys;
  if (!keys || !keys.p256dh || !keys.auth) {
    throw new Error('Invalid subscription keys');
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    userAgent: navigator.userAgent,
  };
}

export const pushNotificationService = {
  // Get VAPID public key from backend (with caching)
  async getVapidPublicKey(): Promise<string> {
    if (cachedVapidPublicKey) {
      return cachedVapidPublicKey;
    }

    try {
      const response = await apiClient.get('/push/public-key');
      if (response.data?.success && response.data?.data?.publicKey) {
        const publicKey = response.data.data.publicKey as string;
        cachedVapidPublicKey = publicKey;
        return publicKey;
      }
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('Failed to fetch VAPID public key:', error);
      throw new Error('Failed to get VAPID public key from server');
    }
  },

  // Check if push notifications are supported
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  // Get current permission status
  getPermission(): NotificationPermission {
    return Notification.permission;
  },

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    const permission = await Notification.requestPermission();
    return permission;
  },

  // Subscribe to push notifications
  async subscribe(): Promise<PushSubscriptionData> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    // Check permission
    const permission = this.getPermission();
    if (permission === 'denied') {
      throw new Error('Push notification permission denied');
    }

    if (permission === 'default') {
      const newPermission = await this.requestPermission();
      if (newPermission !== 'granted') {
        throw new Error('Push notification permission not granted');
      }
    }

    // Get VAPID public key from backend
    const vapidPublicKey = await this.getVapidPublicKey();

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });

    const subscriptionData = subscriptionToData(subscription);

    // Send subscription to backend
    await this.sendSubscriptionToBackend(subscriptionData);

    return subscriptionData;
  },

  // Get existing subscription
  async getSubscription(): Promise<PushSubscriptionData | null> {
    if (!this.isSupported()) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return null;
    }

    return subscriptionToData(subscription);
  },

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const subscriptionData = subscriptionToData(subscription);

      // Remove subscription from backend
      await this.removeSubscriptionFromBackend(subscriptionData);

      // Unsubscribe locally
      await subscription.unsubscribe();
    }
  },

  // Send subscription to backend
  async sendSubscriptionToBackend(subscription: PushSubscriptionData): Promise<void> {
    await apiClient.post('/push/subscribe', subscription);
  },

  // Remove subscription from backend
  async removeSubscriptionFromBackend(subscription: PushSubscriptionData): Promise<void> {
    await apiClient.post('/push/unsubscribe', subscription);
  },

  // Check if user is currently subscribed
  async isSubscribed(): Promise<boolean> {
    const subscription = await this.getSubscription();
    return subscription !== null;
  },

  // Toggle subscription (subscribe if not subscribed, unsubscribe if subscribed)
  async toggleSubscription(): Promise<boolean> {
    const isCurrentlySubscribed = await this.isSubscribed();

    if (isCurrentlySubscribed) {
      await this.unsubscribe();
      return false;
    } else {
      await this.subscribe();
      return true;
    }
  },

  // Send a test notification (for testing purposes)
  async sendTestNotification(): Promise<void> {
    const subscription = await this.getSubscription();
    if (!subscription) {
      throw new Error('Not subscribed to push notifications');
    }

    await apiClient.post('/push/test', { endpoint: subscription.endpoint });
  },
};
