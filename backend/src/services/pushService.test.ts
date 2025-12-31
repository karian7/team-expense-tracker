import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../test/setup';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

import webpush from 'web-push';
import { pushService } from './pushService';

// Helper to create subscription mock
const createSubscriptionMock = (
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  userAgent: string | null = null
) => ({
  id: `test-id-${endpoint.slice(-5)}`,
  endpoint,
  p256dhKey,
  authKey,
  userAgent,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
});

describe('pushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendNotification', () => {
    const mockPayload = {
      title: 'Test',
      body: 'Test message',
      icon: '/icon.png',
      badge: '/badge.png',
      tag: 'test',
      data: { url: '/' },
    };

    it('should return success on successful send', async () => {
      vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

      const result = await pushService.sendNotification(
        'https://fcm.googleapis.com/test',
        'p256dh-key',
        'auth-key',
        mockPayload
      );

      expect(result.success).toBe(true);
      expect(result.shouldRemove).toBe(false);
    });

    it('should return shouldRemove: true on 404', async () => {
      const error = { statusCode: 404, message: 'Not Found' };
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      const result = await pushService.sendNotification(
        'https://fcm.googleapis.com/test',
        'p256dh-key',
        'auth-key',
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.shouldRemove).toBe(true);
    });

    it('should return shouldRemove: true on 410', async () => {
      const error = { statusCode: 410, message: 'Gone' };
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      const result = await pushService.sendNotification(
        'https://fcm.googleapis.com/test',
        'p256dh-key',
        'auth-key',
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.shouldRemove).toBe(true);
    });

    it('should return shouldRemove: true on 401', async () => {
      const error = { statusCode: 401, message: 'Unauthorized' };
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      const result = await pushService.sendNotification(
        'https://fcm.googleapis.com/test',
        'p256dh-key',
        'auth-key',
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.shouldRemove).toBe(true);
    });

    it('should return shouldRemove: true on 403', async () => {
      const error = { statusCode: 403, message: 'Forbidden' };
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      const result = await pushService.sendNotification(
        'https://fcm.googleapis.com/test',
        'p256dh-key',
        'auth-key',
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.shouldRemove).toBe(true);
    });

    it('should return shouldRemove: false on 429 (rate limit)', async () => {
      const error = { statusCode: 429, message: 'Too Many Requests' };
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      const result = await pushService.sendNotification(
        'https://fcm.googleapis.com/test',
        'p256dh-key',
        'auth-key',
        mockPayload
      );

      expect(result.success).toBe(false);
      expect(result.shouldRemove).toBe(false);
    });
  });

  describe('sendToAll', () => {
    const mockPayload = {
      title: 'Test',
      body: 'Test message',
      icon: '/icon.png',
      badge: '/badge.png',
      tag: 'test',
      data: { url: '/' },
    };

    it('should send to all subscriptions', async () => {
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        createSubscriptionMock('https://fcm.googleapis.com/test1', 'key1', 'auth1'),
        createSubscriptionMock('https://fcm.googleapis.com/test2', 'key2', 'auth2'),
      ]);

      vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

      const result = await pushService.sendToAll(mockPayload);

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should auto-delete invalid subscriptions', async () => {
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        createSubscriptionMock('https://fcm.googleapis.com/valid', 'key1', 'auth1'),
        createSubscriptionMock('https://fcm.googleapis.com/invalid', 'key2', 'auth2'),
      ]);

      vi.mocked(webpush.sendNotification)
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce({ statusCode: 410, message: 'Gone' });

      prismaMock.pushSubscription.delete.mockResolvedValue(
        createSubscriptionMock('https://fcm.googleapis.com/invalid', 'key2', 'auth2')
      );

      const result = await pushService.sendToAll(mockPayload);

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: { endpoint: 'https://fcm.googleapis.com/invalid' },
      });
    });
  });

  describe('createOrUpdateSubscription', () => {
    it('should upsert subscription', async () => {
      const mockSubscription = createSubscriptionMock(
        'https://fcm.googleapis.com/test',
        'new-key',
        'new-auth',
        'Mozilla/5.0'
      );

      prismaMock.pushSubscription.upsert.mockResolvedValue(mockSubscription);

      const result = await pushService.createOrUpdateSubscription(
        'https://fcm.googleapis.com/test',
        'new-key',
        'new-auth',
        'Mozilla/5.0'
      );

      expect(result.endpoint).toBe('https://fcm.googleapis.com/test');
      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: 'https://fcm.googleapis.com/test' },
        update: { p256dhKey: 'new-key', authKey: 'new-auth', userAgent: 'Mozilla/5.0' },
        create: {
          endpoint: 'https://fcm.googleapis.com/test',
          p256dhKey: 'new-key',
          authKey: 'new-auth',
          userAgent: 'Mozilla/5.0',
        },
      });
    });
  });
});
