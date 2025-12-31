import { describe, it, expect, beforeEach, vi } from 'vitest';
import { budgetService } from './budgetService';
import { eventService } from './eventService';
import { settingsService } from './settingsService';
import { db, type BudgetEvent } from '../db/database';

vi.mock('../api', () => ({
  settingsApi: {
    getDefaultMonthlyBudget: vi.fn(),
  },
}));

import { settingsApi } from '../api';

const createEvent = (event: Partial<BudgetEvent>): BudgetEvent => ({
  sequence: event.sequence ?? Date.now(),
  eventType: event.eventType ?? 'EXPENSE',
  eventDate: event.eventDate ?? new Date().toISOString(),
  year: event.year ?? 2025,
  month: event.month ?? 1,
  authorName: event.authorName ?? 'SYSTEM',
  amount: event.amount ?? 0,
  storeName: event.storeName ?? null,
  description: event.description ?? null,
  receiptImage: event.receiptImage ?? null,
  ocrRawData: event.ocrRawData ?? null,
  referenceSequence: event.referenceSequence ?? null,
  createdAt: event.createdAt ?? event.eventDate ?? new Date().toISOString(),
  isLocalOnly: event.isLocalOnly,
  syncState: event.syncState,
  pendingId: event.pendingId,
});

describe('budgetService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    vi.clearAllMocks();
  });

  describe('ensureMonthlyBudget', () => {
    it('should skip when initial sync not completed', async () => {
      vi.spyOn(settingsService, 'isInitialSyncCompleted').mockResolvedValue(false);

      const result = await budgetService.ensureMonthlyBudget(2025, 1);

      expect(result).toBe(false);
      expect(settingsApi.getDefaultMonthlyBudget).not.toHaveBeenCalled();
    });

    it('should return false when budget already exists', async () => {
      vi.spyOn(settingsService, 'isInitialSyncCompleted').mockResolvedValue(true);

      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: 300000,
          description: '기본 월별 예산',
        }),
      ]);

      const result = await budgetService.ensureMonthlyBudget(2025, 1);

      expect(result).toBe(false);
    });

    it('should fetch defaultBudget from server and create budget', async () => {
      vi.spyOn(settingsService, 'isInitialSyncCompleted').mockResolvedValue(true);
      vi.mocked(settingsApi.getDefaultMonthlyBudget).mockResolvedValue(300000);

      const result = await budgetService.ensureMonthlyBudget(2025, 1);

      expect(result).toBe(true);
      expect(settingsApi.getDefaultMonthlyBudget).toHaveBeenCalled();

      const events = await eventService.getEventsByMonth(2025, 1);
      expect(events.some((e) => e.eventType === 'BUDGET_IN')).toBe(true);
    });

    it('should prevent duplicate calls with TaskMap', async () => {
      vi.spyOn(settingsService, 'isInitialSyncCompleted').mockResolvedValue(true);
      vi.mocked(settingsApi.getDefaultMonthlyBudget).mockResolvedValue(300000);

      // 동시에 3번 호출
      const results = await Promise.all([
        budgetService.ensureMonthlyBudget(2025, 2),
        budgetService.ensureMonthlyBudget(2025, 2),
        budgetService.ensureMonthlyBudget(2025, 2),
      ]);

      // 첫 번째만 true, 나머지는 같은 Promise를 공유하므로 모두 true
      expect(results.filter((r) => r).length).toBeGreaterThan(0);

      // API는 한 번만 호출됨
      expect(settingsApi.getDefaultMonthlyBudget).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMonthlyBudget', () => {
    it('should delegate to eventService.calculateMonthlyBudget', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: 300000,
        }),
        createEvent({
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        }),
      ]);

      const budget = await budgetService.getMonthlyBudget(2025, 1);

      expect(budget.budgetIn).toBe(300000);
      expect(budget.totalSpent).toBe(50000);
      expect(budget.balance).toBe(250000);
    });
  });
});
