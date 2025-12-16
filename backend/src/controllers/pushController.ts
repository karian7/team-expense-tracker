import type { Request, Response } from 'express';
import type { PushSubscriptionRequest, PushNotificationPayload, ApiResponse } from '../types';
import { pushService } from '../services/pushService';

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

      const subscription = await pushService.createOrUpdateSubscription(
        endpoint,
        keys.p256dh,
        keys.auth,
        userAgent
      );

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

      await pushService.deleteSubscription(endpoint);

      return res.json({
        success: true,
        message: 'Successfully unsubscribed from push notifications',
      } as ApiResponse);
    } catch {
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

      const subscription = await pushService.findSubscription(endpoint);

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
        data: { url: '/' },
      };

      const result = await pushService.sendNotification(
        subscription.endpoint,
        subscription.p256dhKey,
        subscription.authKey,
        payload
      );

      if (!result.success) {
        if (result.shouldRemove) {
          await pushService.deleteSubscription(endpoint);
        }
        return res.status(500).json({
          success: false,
          error: 'Failed to send test notification',
        } as ApiResponse);
      }

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

  // Get VAPID public key
  getPublicKey: async (_req: Request, res: Response) => {
    try {
      const publicKey = pushService.getVapidPublicKey();

      if (!publicKey) {
        return res.status(500).json({
          success: false,
          error: 'VAPID public key not configured',
        } as ApiResponse);
      }

      return res.json({
        success: true,
        data: { publicKey },
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
