import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAdjustCurrentBudget } from './useBudget';
import { budgetService } from '../services/local/budgetService';
import { eventService } from '../services/local/eventService';
import { syncService } from '../services/sync/syncService';
import { db } from '../services/db/database';

vi.mock('../services/local/budgetService', () => ({
  budgetService: {
    getCurrentBudget: vi.fn(),
    ensureMonthlyBudget: vi.fn(),
    getMonthlyBudget: vi.fn(),
  },
}));

vi.mock('../services/local/eventService', () => ({
  eventService: {
    createLocalEvent: vi.fn(),
  },
}));

vi.mock('../services/sync/syncService', () => ({
  syncService: {
    sync: vi.fn(),
  },
}));

describe('useBudget hooks', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
  });

  describe('useAdjustCurrentBudget', () => {
    it('should adjust budget with INCREASE when target > balance', async () => {
      vi.mocked(budgetService.getCurrentBudget).mockResolvedValue({
        year: 2025,
        month: 1,
        budgetIn: 300000,
        previousBalance: 0,
        totalBudget: 300000,
        totalSpent: 50000,
        balance: 250000,
        eventCount: 2,
      });

      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1000,
        eventType: 'BUDGET_ADJUSTMENT_INCREASE',
        eventDate: new Date().toISOString(),
        year: 2025,
        month: 1,
        authorName: 'SYSTEM',
        amount: 50000,
        description: '추가 예산',
        storeName: null,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: new Date().toISOString(),
      });

      vi.mocked(syncService.sync).mockResolvedValue({
        newEvents: 0,
        pushedEvents: 1,
        lastSequence: 1,
      });

      const { result } = renderHook(() => useAdjustCurrentBudget());

      await result.current.mutateAsync({
        targetBalance: 300000,
        description: '추가 예산',
      });

      expect(eventService.createLocalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BUDGET_ADJUSTMENT_INCREASE',
          amount: 50000,
        })
      );
    });

    it('should adjust budget with DECREASE when target < balance', async () => {
      vi.mocked(budgetService.getCurrentBudget).mockResolvedValue({
        year: 2025,
        month: 1,
        budgetIn: 300000,
        previousBalance: 0,
        totalBudget: 300000,
        totalSpent: 50000,
        balance: 250000,
        eventCount: 2,
      });

      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1000,
        eventType: 'BUDGET_ADJUSTMENT_DECREASE',
        eventDate: new Date().toISOString(),
        year: 2025,
        month: 1,
        authorName: 'SYSTEM',
        amount: 50000,
        description: '예산 감액',
        storeName: null,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: new Date().toISOString(),
      });

      vi.mocked(syncService.sync).mockResolvedValue({
        newEvents: 0,
        pushedEvents: 1,
        lastSequence: 1,
      });

      const { result } = renderHook(() => useAdjustCurrentBudget());

      await result.current.mutateAsync({
        targetBalance: 200000,
        description: '예산 감액',
      });

      expect(eventService.createLocalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BUDGET_ADJUSTMENT_DECREASE',
          amount: 50000,
        })
      );
    });

    it('should maintain local event on sync failure', async () => {
      vi.mocked(budgetService.getCurrentBudget).mockResolvedValue({
        year: 2025,
        month: 1,
        budgetIn: 300000,
        previousBalance: 0,
        totalBudget: 300000,
        totalSpent: 50000,
        balance: 250000,
        eventCount: 2,
      });

      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1000,
        eventType: 'BUDGET_ADJUSTMENT_INCREASE',
        eventDate: new Date().toISOString(),
        year: 2025,
        month: 1,
        authorName: 'SYSTEM',
        amount: 50000,
        description: '추가 예산',
        storeName: null,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: new Date().toISOString(),
      });

      vi.mocked(syncService.sync).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAdjustCurrentBudget());

      // Should not throw even if sync fails
      await expect(
        result.current.mutateAsync({
          targetBalance: 300000,
          description: '추가 예산',
        })
      ).resolves.not.toThrow();

      // Local event should have been created
      expect(eventService.createLocalEvent).toHaveBeenCalled();
    });
  });
});
