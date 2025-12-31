import { describe, it, expect, beforeEach } from 'vitest';
import { pendingEventService } from './pendingEventService';
import { db } from '../db/database';

describe('pendingEventService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  describe('enqueue', () => {
    it('should create pending event', async () => {
      const payload = {
        eventType: 'EXPENSE' as const,
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
      };

      const pending = await pendingEventService.enqueue(payload, -1000);

      expect(pending.id).toBeDefined();
      expect(pending.tempSequence).toBe(-1000);
      expect(pending.status).toBe('pending');
      expect(pending.payload).toEqual(payload);
    });

    it('should create negative tempSequence', async () => {
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        },
        -1733596800000001
      );

      expect(pending.tempSequence).toBeLessThan(0);
    });

    it('should set createdAt timestamp', async () => {
      const before = new Date().toISOString();

      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        },
        -1000
      );

      const after = new Date().toISOString();

      expect(pending.createdAt >= before).toBe(true);
      expect(pending.createdAt <= after).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return events sorted by createdAt', async () => {
      // 3개의 pending 이벤트 생성 (다른 시간)
      const pending1 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User 1',
          amount: 10000,
        },
        -1000
      );

      // createdAt 수정
      await db.pendingEvents.update(pending1.id, {
        createdAt: '2025-01-15T12:00:00.000Z',
      });

      const pending2 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-16T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User 2',
          amount: 20000,
        },
        -2000
      );

      await db.pendingEvents.update(pending2.id, {
        createdAt: '2025-01-16T12:00:00.000Z',
      });

      const pending3 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-14T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User 3',
          amount: 30000,
        },
        -3000
      );

      await db.pendingEvents.update(pending3.id, {
        createdAt: '2025-01-14T12:00:00.000Z',
      });

      const all = await pendingEventService.getAll();

      expect(all.length).toBe(3);
      expect(all[0].payload.authorName).toBe('User 3'); // 가장 오래된 것
      expect(all[1].payload.authorName).toBe('User 1');
      expect(all[2].payload.authorName).toBe('User 2'); // 가장 최근
    });

    it('should sort by tempSequence (descending) when createdAt is same', async () => {
      const sameTime = '2025-01-15T12:00:00.000Z';

      const pending1 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: sameTime,
          year: 2025,
          month: 1,
          authorName: 'User A',
          amount: 10000,
        },
        -1000
      );
      await db.pendingEvents.update(pending1.id, { createdAt: sameTime });

      const pending2 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: sameTime,
          year: 2025,
          month: 1,
          authorName: 'User B',
          amount: 20000,
        },
        -2000
      );
      await db.pendingEvents.update(pending2.id, { createdAt: sameTime });

      const all = await pendingEventService.getAll();

      expect(all.length).toBe(2);
      // tempSequence가 더 큰 것(-1000 > -2000)이 먼저
      expect(all[0].tempSequence).toBe(-1000);
      expect(all[1].tempSequence).toBe(-2000);
    });
  });

  describe('updateStatus', () => {
    it('should update status from pending to syncing', async () => {
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        },
        -1000
      );

      await pendingEventService.updateStatus(pending.id, 'syncing');

      const updated = await db.pendingEvents.get(pending.id);
      expect(updated?.status).toBe('syncing');
    });

    it('should update status from syncing to failed', async () => {
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        },
        -1000
      );

      await pendingEventService.updateStatus(pending.id, 'syncing');
      await pendingEventService.updateStatus(pending.id, 'failed');

      const updated = await db.pendingEvents.get(pending.id);
      expect(updated?.status).toBe('failed');
    });

    it('should set lastError on failure', async () => {
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        },
        -1000
      );

      await pendingEventService.updateStatus(pending.id, 'failed', 'Network error');

      const updated = await db.pendingEvents.get(pending.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.lastError).toBe('Network error');
    });
  });

  describe('remove', () => {
    it('should remove pending event', async () => {
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        },
        -1000
      );

      await pendingEventService.remove(pending.id);

      const removed = await db.pendingEvents.get(pending.id);
      expect(removed).toBeUndefined();
    });
  });

  describe('count', () => {
    it('should return correct count', async () => {
      expect(await pendingEventService.count()).toBe(0);

      await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User 1',
          amount: 10000,
        },
        -1000
      );

      expect(await pendingEventService.count()).toBe(1);

      await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-16T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User 2',
          amount: 20000,
        },
        -2000
      );

      expect(await pendingEventService.count()).toBe(2);
    });
  });
});
