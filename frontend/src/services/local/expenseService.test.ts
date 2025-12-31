import { describe, it, expect, beforeEach } from 'vitest';
import { expenseService } from './expenseService';
import { eventService } from './eventService';
import { db, type BudgetEvent } from '../db/database';

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

describe('expenseService', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  describe('getExpensesByMonth', () => {
    it('should filter only EXPENSE type', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00.000Z',
          year: 2025,
          month: 1,
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
          storeName: '맛있는 식당',
        }),
        createEvent({
          sequence: 3,
          eventType: 'BUDGET_ADJUSTMENT_INCREASE',
          eventDate: '2025-01-20T12:00:00.000Z',
          year: 2025,
          month: 1,
          amount: 100000,
        }),
      ]);

      const expenses = await expenseService.getExpensesByMonth(2025, 1);

      expect(expenses.length).toBe(1);
      expect(expenses[0].eventType).toBe('EXPENSE');
      expect(expenses[0].amount).toBe(50000);
    });

    it('should exclude expenses referenced by EXPENSE_REVERSAL', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'EXPENSE',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
          storeName: '식당A',
        }),
        createEvent({
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '김철수',
          amount: 30000,
          storeName: '식당B',
        }),
        createEvent({
          sequence: 3,
          eventType: 'EXPENSE_REVERSAL',
          eventDate: '2025-01-16T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
          referenceSequence: 1, // sequence 1을 삭제
        }),
      ]);

      const expenses = await expenseService.getExpensesByMonth(2025, 1);

      expect(expenses.length).toBe(1);
      expect(expenses[0].sequence).toBe(2);
      expect(expenses[0].storeName).toBe('식당B');
    });

    it('should sort by eventDate ascending', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 3,
          eventType: 'EXPENSE',
          eventDate: '2025-01-20T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User C',
          amount: 30000,
        }),
        createEvent({
          sequence: 1,
          eventType: 'EXPENSE',
          eventDate: '2025-01-05T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User A',
          amount: 10000,
        }),
        createEvent({
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User B',
          amount: 20000,
        }),
      ]);

      const expenses = await expenseService.getExpensesByMonth(2025, 1);

      expect(expenses.length).toBe(3);
      expect(expenses[0].authorName).toBe('User A');
      expect(expenses[1].authorName).toBe('User B');
      expect(expenses[2].authorName).toBe('User C');
    });
  });

  describe('isExpenseDeleted', () => {
    it('should return true when EXPENSE_REVERSAL exists', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'EXPENSE',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        }),
        createEvent({
          sequence: 2,
          eventType: 'EXPENSE_REVERSAL',
          eventDate: '2025-01-11T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
          referenceSequence: 1,
        }),
      ]);

      const isDeleted = await expenseService.isExpenseDeleted(1);

      expect(isDeleted).toBe(true);
    });

    it('should return false when not deleted', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'EXPENSE',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        }),
      ]);

      const isDeleted = await expenseService.isExpenseDeleted(1);

      expect(isDeleted).toBe(false);
    });
  });

  describe('getExpenseById', () => {
    it('should return expense by sequence', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'EXPENSE',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
          storeName: '맛있는 식당',
        }),
      ]);

      const expense = await expenseService.getExpenseById(1);

      expect(expense).toBeDefined();
      expect(expense?.amount).toBe(50000);
    });

    it('should return undefined for deleted expense', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'EXPENSE',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        }),
        createEvent({
          sequence: 2,
          eventType: 'EXPENSE_REVERSAL',
          eventDate: '2025-01-11T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
          referenceSequence: 1,
        }),
      ]);

      const expense = await expenseService.getExpenseById(1);

      expect(expense).toBeUndefined();
    });

    it('should return undefined for non-EXPENSE event', async () => {
      await eventService.saveEvents([
        createEvent({
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00.000Z',
          year: 2025,
          month: 1,
          amount: 300000,
        }),
      ]);

      const expense = await expenseService.getExpenseById(1);

      expect(expense).toBeUndefined();
    });
  });
});
