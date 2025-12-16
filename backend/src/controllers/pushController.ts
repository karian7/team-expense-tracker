import type { Request, Response } from 'express';
import type { PushSubscriptionRequest, PushNotificationPayload, ApiResponse } from '../types';
import webpush from 'web-push';
import prisma from '../utils/prisma';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export const pushController = {
  // Subscribe to push notifications
  subscribe: async (req: Request, res: Response) => {
    try {
      const { endpoint, keys, userAgent } = req.body as PushSubscriptionRequest;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({
          success: false,
          error: 'Invalid subscription data',
        } as ApiResponse);
      }

      // Upsert subscription (update if exists, create if not)
      const subscription = await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: {
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
          userAgent,
        },
        create: {
          endpoint,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
          userAgent,
        },
      });

      return res.json({
        success: true,
        data: { id: subscription.id },
        message: 'Successfully subscribed to push notifications',
      } as ApiResponse);
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to subscribe to push notifications',
      } as ApiResponse);
    }
  },

  // Unsubscribe from push notifications
  unsubscribe: async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.body as PushSubscriptionRequest;

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint is required',
        } as ApiResponse);
      }

      await prisma.pushSubscription.delete({
        where: { endpoint },
      });

      return res.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      } as ApiResponse);
    } catch {
      // Subscription might not exist
      return res.json({
        success: true,
        message: 'Unsubscribed',
      } as ApiResponse);
    }
  },

  // Send a test notification
  test: async (req: Request, res: Response) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint is required',
        } as ApiResponse);
      }

      const subscription = await prisma.pushSubscription.findUnique({
        where: { endpoint },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          error: 'Subscription not found',
        } as ApiResponse);
      }

      const payload: PushNotificationPayload = {
        title: '테스트 알림',
        body: '푸시 알림이 정상적으로 작동합니다!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'test',
        data: {
          url: '/',
        },
      };

      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dhKey,
            auth: subscription.authKey,
          },
        },
        JSON.stringify(payload)
      );

      return res.json({
        success: true,
        message: 'Test notification sent',
      } as ApiResponse);
    } catch (error) {
      console.error('Error sending test notification:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to send test notification',
      } as ApiResponse);
    }
  },

  // Send notification to all subscribers
  sendToAll: async (payload: PushNotificationPayload) => {
    try {
      const subscriptions = await prisma.pushSubscription.findMany();

      const notifications = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dhKey,
                auth: subscription.authKey,
              },
            },
            JSON.stringify(payload)
          );
        } catch (error) {
          console.error(`Failed to send notification to ${subscription.endpoint}:`, error);

          // If subscription is invalid (410 Gone), remove it
          if ((error as { statusCode?: number }).statusCode === 410) {
            await prisma.pushSubscription.delete({
              where: { endpoint: subscription.endpoint },
            });
          }
        }
      });

      await Promise.allSettled(notifications);
    } catch (error) {
      console.error('Error sending notifications to all:', error);
    }
  },

  // Get VAPID public key
  getPublicKey: async (_req: Request, res: Response) => {
    try {
      if (!vapidPublicKey) {
        return res.status(500).json({
          success: false,
          error: 'VAPID public key not configured',
        } as ApiResponse);
      }

      return res.json({
        success: true,
        data: { publicKey: vapidPublicKey },
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting public key:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get public key',
      } as ApiResponse);
    }
  },
};
