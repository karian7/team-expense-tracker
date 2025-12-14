import { describe, it, expect, beforeEach } from 'vitest';
import { eventService } from './eventService';
import { expenseService } from './expenseService';
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

describe('eventService BUDGET_RESET filtering', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('excludes events that happened before the latest reset even if reset has negative sequence', async () => {
    await eventService.saveEvents([
      createEvent({
        sequence: 1,
        eventType: 'BUDGET_IN',
        eventDate: '2025-12-01T00:00:00.000Z',
        year: 2025,
        month: 12,
        amount: 1_000_000,
      }),
      createEvent({
        sequence: 2,
        eventType: 'EXPENSE',
        eventDate: '2025-12-03T12:00:00.000Z',
        year: 2025,
        month: 12,
        amount: 100_000,
      }),
      createEvent({
        sequence: 3,
        eventType: 'BUDGET_RESET',
        eventDate: '2025-12-10T00:00:00.000Z',
        year: 2025,
        month: 12,
      }),
      // 최신 리셋 (로컬, 아직 서버 동기화 전이라 음수 sequence)
      createEvent({
        sequence: -100,
        eventType: 'BUDGET_RESET',
        eventDate: '2025-12-14T09:00:00.000Z',
        year: 2025,
        month: 12,
      }),
      // 리셋 이후 새 지출 (temp sequence)
      createEvent({
        sequence: -200,
        eventType: 'EXPENSE',
        eventDate: '2025-12-15T10:00:00.000Z',
        year: 2025,
        month: 12,
        authorName: 'User A',
        amount: 50_000,
      }),
    ]);

    const events = await eventService.getEventsByMonth(2025, 12);
    expect(events).toHaveLength(1);
    expect(events[0].sequence).toBe(-200);
  });

  it('exposes expenses created after reset through expenseService ordering by eventDate', async () => {
    await eventService.saveEvents([
      createEvent({
        sequence: 10,
        eventType: 'BUDGET_IN',
        eventDate: '2025-12-01T00:00:00.000Z',
        year: 2025,
        month: 12,
        amount: 500_000,
      }),
      createEvent({
        sequence: 11,
        eventType: 'EXPENSE',
        eventDate: '2025-12-05T09:00:00.000Z',
        year: 2025,
        month: 12,
        amount: 120_000,
      }),
      createEvent({
        sequence: 12,
        eventType: 'BUDGET_RESET',
        eventDate: '2025-12-10T00:00:00.000Z',
        year: 2025,
        month: 12,
      }),
      createEvent({
        sequence: 20,
        eventType: 'EXPENSE',
        eventDate: '2025-12-16T12:00:00.000Z',
        year: 2025,
        month: 12,
        amount: 80_000,
      }),
      createEvent({
        sequence: 21,
        eventType: 'EXPENSE',
        eventDate: '2025-12-18T12:00:00.000Z',
        year: 2025,
        month: 12,
        amount: 30_000,
      }),
    ]);

    const expenses = await expenseService.getExpensesByMonth(2025, 12);
    expect(expenses.map((expense) => expense.sequence)).toEqual([20, 21]);
  });
});
