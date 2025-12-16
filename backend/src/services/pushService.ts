import webpush from 'web-push';
import prisma from '../utils/prisma';
import type { PushNotificationPayload } from '../types';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

// HTTP status codes that indicate subscription should be removed
const INVALID_SUBSCRIPTION_STATUS_CODES = [404, 410];
// HTTP status codes that indicate authentication failure
const AUTH_FAILURE_STATUS_CODES = [401, 403];

interface WebPushError {
  statusCode?: number;
  message?: string;
}

export const pushService = {
  getVapidPublicKey(): string | null {
    return vapidPublicKey || null;
  },

  async createOrUpdateSubscription(
    endpoint: string,
    p256dhKey: string,
    authKey: string,
    userAgent?: string
  ) {
    return prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dhKey, authKey, userAgent },
      create: { endpoint, p256dhKey, authKey, userAgent },
    });
  },

  async deleteSubscription(endpoint: string): Promise<boolean> {
    try {
      await prisma.pushSubscription.delete({ where: { endpoint } });
      return true;
    } catch {
      return false;
    }
  },

  async findSubscription(endpoint: string) {
    return prisma.pushSubscription.findUnique({ where: { endpoint } });
  },

  async sendNotification(
    endpoint: string,
    p256dhKey: string,
    authKey: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; shouldRemove: boolean }> {
    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh: p256dhKey, auth: authKey } },
        JSON.stringify(payload)
      );
      return { success: true, shouldRemove: false };
    } catch (error) {
      const webPushError = error as WebPushError;
      const statusCode = webPushError.statusCode;

      // 구독이 무효한 경우 (404, 410)
      if (statusCode && INVALID_SUBSCRIPTION_STATUS_CODES.includes(statusCode)) {
        console.warn(`Subscription invalid (${statusCode}): ${endpoint}`);
        return { success: false, shouldRemove: true };
      }

      // 인증 실패 (401, 403)
      if (statusCode && AUTH_FAILURE_STATUS_CODES.includes(statusCode)) {
        console.warn(`Auth failure (${statusCode}): ${endpoint}`);
        return { success: false, shouldRemove: true };
      }

      // Rate limit (429) - 로깅만, 구독 유지
      if (statusCode === 429) {
        console.warn(`Rate limited for endpoint: ${endpoint}`);
        return { success: false, shouldRemove: false };
      }

      // 기타 에러 - 로깅 후 구독 유지
      console.error(`Failed to send notification to ${endpoint}:`, error);
      return { success: false, shouldRemove: false };
    }
  },

  async sendToAll(payload: PushNotificationPayload): Promise<{ sent: number; failed: number }> {
    const subscriptions = await prisma.pushSubscription.findMany();
    let sent = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        const result = await this.sendNotification(
          subscription.endpoint,
          subscription.p256dhKey,
          subscription.authKey,
          payload
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          if (result.shouldRemove) {
            await this.deleteSubscription(subscription.endpoint);
          }
        }
      })
    );

    console.log(`Push notifications sent: ${sent}/${results.length}, failed: ${failed}`);

    return { sent, failed };
  },
};
