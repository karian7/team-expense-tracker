import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../test/setup';
import {
  createBudgetEvent,
  syncEvents,
  calculateMonthlyBalance,
  checkBudgetThreshold,
  clearNotificationCache,
} from './budgetEventService';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';

vi.mock('./pushService', () => ({
  pushService: {
    sendToAll: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./settingsService', () => ({
  setNeedsFullSync: vi.fn().mockResolvedValue(undefined),
}));

import { pushService } from './pushService';

describe('budgetEventService', () => {
  beforeEach(() => {
    clearNotificationCache();
    vi.clearAllMocks();
  });

  describe('createBudgetEvent', () => {
    it('should create a budget event', async () => {
      const mockEvent = {
        sequence: 1,
        eventType: 'EXPENSE',
        eventDate: new Date('2025-01-15'),
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: new Decimal(50000),
        storeName: '맛있는 식당',
        description: '팀 점심',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: new Date(),
      };

      prismaMock.budgetEvent.create.mockResolvedValue(mockEvent);

      const result = await createBudgetEvent(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
          storeName: '맛있는 식당',
          description: '팀 점심',
        },
        { sendPushNotification: false }
      );

      expect(result.sequence).toBe(1);
      expect(result.eventType).toBe('EXPENSE');
      expect(result.amount).toBe(50000);
      expect(prismaMock.budgetEvent.create).toHaveBeenCalledOnce();
    });

    it('should handle race condition for duplicate default monthly budget', async () => {
      const existingEvent = {
        sequence: 1,
        eventType: 'BUDGET_IN',
        eventDate: new Date('2025-01-01'),
        year: 2025,
        month: 1,
        authorName: BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
        amount: new Decimal(300000),
        storeName: null,
        description: BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: new Date(),
      };

      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });

      prismaMock.budgetEvent.create.mockRejectedValue(uniqueError);
      prismaMock.budgetEvent.findFirst.mockResolvedValue(existingEvent);

      const result = await createBudgetEvent(
        {
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00Z',
          year: 2025,
          month: 1,
          authorName: BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
          amount: 300000,
          description: BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION,
        },
        { sendPushNotification: false }
      );

      expect(result.sequence).toBe(1);
      expect(result.amount).toBe(300000);
    });
  });

  describe('syncEvents', () => {
    it('should return events since given sequence', async () => {
      const mockEvents = [
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date('2025-01-15'),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(30000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ];

      prismaMock.budgetEvent.findFirst.mockResolvedValue(null);
      prismaMock.budgetEvent.findMany.mockResolvedValue(mockEvents);
      prismaMock.budgetEvent.count.mockResolvedValue(2);

      const result = await syncEvents(1);

      expect(result.lastSequence).toBe(2);
      expect(result.events).toHaveLength(1);
      expect(result.needsFullSync).toBe(false);
    });

    it('should filter events after BUDGET_RESET', async () => {
      const resetEvent = {
        sequence: 5,
        eventType: 'BUDGET_RESET',
        eventDate: new Date(),
        year: 2025,
        month: 1,
        authorName: 'SYSTEM',
        amount: new Decimal(0),
        storeName: null,
        description: null,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: new Date(),
      };

      prismaMock.budgetEvent.findFirst.mockResolvedValue(resetEvent);
      prismaMock.budgetEvent.findMany.mockResolvedValue([]);
      prismaMock.budgetEvent.count.mockResolvedValue(1);

      const result = await syncEvents(1);

      expect(prismaMock.budgetEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sequence: {
              gt: 4,
            },
          },
        })
      );
      expect(result.lastSequence).toBe(5);
    });

    it('should set needsFullSync when DB is empty', async () => {
      prismaMock.budgetEvent.findFirst.mockResolvedValue(null);
      prismaMock.budgetEvent.findMany.mockResolvedValue([]);
      prismaMock.budgetEvent.count.mockResolvedValue(0);

      const result = await syncEvents(0);

      expect(result.needsFullSync).toBe(true);
    });
  });

  describe('calculateMonthlyBalance', () => {
    it('should calculate BUDGET_IN + EXPENSE correctly', async () => {
      prismaMock.budgetEvent.findMany.mockResolvedValue([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(300000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(50000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ]);

      const result = await calculateMonthlyBalance(2025, 1);

      expect(result.totalBudget).toBe(300000);
      expect(result.spent).toBe(50000);
      expect(result.balance).toBe(250000);
    });

    it('should reflect BUDGET_ADJUSTMENT correctly', async () => {
      prismaMock.budgetEvent.findMany.mockResolvedValue([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(300000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'BUDGET_ADJUSTMENT_INCREASE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '관리자',
          amount: new Decimal(50000),
          storeName: null,
          description: '추가 예산',
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 3,
          eventType: 'BUDGET_ADJUSTMENT_DECREASE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '관리자',
          amount: new Decimal(20000),
          storeName: null,
          description: '예산 감액',
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ]);

      const result = await calculateMonthlyBalance(2025, 1);

      expect(result.totalBudget).toBe(330000);
      expect(result.balance).toBe(330000);
    });

    it('should calculate spentPercentage accurately', async () => {
      prismaMock.budgetEvent.findMany.mockResolvedValue([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(100000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(85000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ]);

      const result = await calculateMonthlyBalance(2025, 1);

      expect(result.spentPercentage).toBe(85);
    });
  });

  describe('checkBudgetThreshold', () => {
    it('should warn at 80% threshold', async () => {
      prismaMock.budgetEvent.findMany.mockResolvedValue([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(100000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(82000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ]);

      await checkBudgetThreshold(2025, 1);

      expect(pushService.sendToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '⚠️ 예산 경고',
          tag: 'budget-warning-80',
        })
      );
    });

    it('should warn at 90% threshold', async () => {
      prismaMock.budgetEvent.findMany.mockResolvedValue([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(100000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(92000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ]);

      await checkBudgetThreshold(2025, 1);

      expect(pushService.sendToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🚨 예산 위험',
          tag: 'budget-warning-90',
        })
      );
    });

    it('should alert at 100% threshold (deficit)', async () => {
      prismaMock.budgetEvent.findMany.mockResolvedValue([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(100000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(105000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ]);

      await checkBudgetThreshold(2025, 1);

      expect(pushService.sendToAll).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '⚠️ 예산 초과',
          tag: 'budget-exceeded',
        })
      );
    });

    it('should prevent duplicate notifications', async () => {
      const events = [
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: new Decimal(100000),
          storeName: null,
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: new Date(),
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: new Decimal(85000),
          storeName: '식당',
          description: null,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: new Date(),
        },
      ];

      prismaMock.budgetEvent.findMany.mockResolvedValue(events);

      await checkBudgetThreshold(2025, 1);
      await checkBudgetThreshold(2025, 1);

      expect(pushService.sendToAll).toHaveBeenCalledTimes(1);
    });
  });
});
