import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCreateExpense, useDeleteExpense } from './useExpenses';
import { eventService } from '../services/local/eventService';
import { expenseService } from '../services/local/expenseService';
import { syncService } from '../services/sync/syncService';
import { db } from '../services/db/database';

vi.mock('../services/local/eventService', () => ({
  eventService: {
    createLocalEvent: vi.fn(),
  },
}));

vi.mock('../services/local/expenseService', () => ({
  expenseService: {
    getExpenseById: vi.fn(),
    isExpenseDeleted: vi.fn(),
    getExpensesByMonth: vi.fn(),
  },
}));

vi.mock('../services/sync/syncService', () => ({
  syncService: {
    sync: vi.fn(),
  },
}));

describe('useExpenses hooks', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete();
    await db.open();
  });

  describe('useCreateExpense', () => {
    it('should create expense', async () => {
      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1000,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
        description: '팀 점심',
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

      const { result } = renderHook(() => useCreateExpense());

      const expense = await result.current.mutateAsync({
        expenseDate: '2025-01-15',
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
        description: '팀 점심',
      });

      expect(expense.amount).toBe(50000);
      expect(eventService.createLocalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EXPENSE',
          authorName: '홍길동',
          amount: 50000,
        })
      );
    });

    it('should create event with temp sequence (negative)', async () => {
      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1733596800000001,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
        description: null,
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

      const { result } = renderHook(() => useCreateExpense());

      const expense = await result.current.mutateAsync({
        expenseDate: '2025-01-15',
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
      });

      expect(expense.sequence).toBeLessThan(0);
    });
  });

  describe('useDeleteExpense', () => {
    it('should create EXPENSE_REVERSAL event', async () => {
      vi.mocked(expenseService.getExpenseById).mockResolvedValue({
        sequence: 1,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
        description: '팀 점심',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: '2025-01-15T12:00:00.000Z',
      });

      vi.mocked(expenseService.isExpenseDeleted).mockResolvedValue(false);

      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1000,
        eventType: 'EXPENSE_REVERSAL',
        eventDate: new Date().toISOString(),
        year: 2025,
        month: 1,
        authorName: 'SYSTEM',
        amount: 50000,
        storeName: '맛있는 식당',
        description: '지출 삭제: 팀 점심',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: 1,
        createdAt: new Date().toISOString(),
      });

      vi.mocked(syncService.sync).mockResolvedValue({
        newEvents: 0,
        pushedEvents: 1,
        lastSequence: 1,
      });

      const { result } = renderHook(() => useDeleteExpense());

      await result.current.mutateAsync({ sequence: 1 });

      expect(eventService.createLocalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EXPENSE_REVERSAL',
          referenceSequence: 1,
          amount: 50000,
        })
      );
    });

    it('should include referenceSequence in reversal', async () => {
      vi.mocked(expenseService.getExpenseById).mockResolvedValue({
        sequence: 42,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 30000,
        storeName: '카페',
        description: null,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: '2025-01-15T12:00:00.000Z',
      });

      vi.mocked(expenseService.isExpenseDeleted).mockResolvedValue(false);

      vi.mocked(eventService.createLocalEvent).mockResolvedValue({
        sequence: -1000,
        eventType: 'EXPENSE_REVERSAL',
        eventDate: new Date().toISOString(),
        year: 2025,
        month: 1,
        authorName: 'SYSTEM',
        amount: 30000,
        storeName: '카페',
        description: '지출 삭제: 카페',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: 42,
        createdAt: new Date().toISOString(),
      });

      vi.mocked(syncService.sync).mockResolvedValue({
        newEvents: 0,
        pushedEvents: 1,
        lastSequence: 1,
      });

      const { result } = renderHook(() => useDeleteExpense());

      await result.current.mutateAsync({ sequence: 42 });

      expect(eventService.createLocalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceSequence: 42,
        })
      );
    });

    it('should throw error when expense not found', async () => {
      vi.mocked(expenseService.getExpenseById).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteExpense());

      await expect(result.current.mutateAsync({ sequence: 999 })).rejects.toThrow(
        '삭제할 지출을 찾을 수 없습니다'
      );
    });

    it('should throw error when expense already deleted', async () => {
      vi.mocked(expenseService.getExpenseById).mockResolvedValue({
        sequence: 1,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
        description: null,
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: '2025-01-15T12:00:00.000Z',
      });

      vi.mocked(expenseService.isExpenseDeleted).mockResolvedValue(true);

      const { result } = renderHook(() => useDeleteExpense());

      await expect(result.current.mutateAsync({ sequence: 1 })).rejects.toThrow(
        '이미 삭제된 지출입니다'
      );
    });
  });
});
