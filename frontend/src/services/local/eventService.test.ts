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

describe('eventService calculateMonthlyBudget', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('should calculate carryover from previous month balance', async () => {
    // 1월: 예산 300,000 - 지출 50,000 = 잔액 250,000
    await eventService.saveEvents([
      createEvent({
        sequence: 1,
        eventType: 'BUDGET_IN',
        eventDate: '2025-01-01T00:00:00.000Z',
        year: 2025,
        month: 1,
        amount: 300_000,
      }),
      createEvent({
        sequence: 2,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        amount: 50_000,
      }),
    ]);

    // 2월: 예산 300,000 + 이월 250,000
    await eventService.saveEvents([
      createEvent({
        sequence: 3,
        eventType: 'BUDGET_IN',
        eventDate: '2025-02-01T00:00:00.000Z',
        year: 2025,
        month: 2,
        amount: 300_000,
      }),
    ]);

    const febBudget = await eventService.calculateMonthlyBudget(2025, 2);

    expect(febBudget.previousBalance).toBe(250_000);
    expect(febBudget.budgetIn).toBe(300_000);
    expect(febBudget.totalBudget).toBe(550_000);
    expect(febBudget.balance).toBe(550_000);
  });

  it('should verify double-entry accounting (BUDGET_IN + EXPENSE)', async () => {
    await eventService.saveEvents([
      createEvent({
        sequence: 1,
        eventType: 'BUDGET_IN',
        eventDate: '2025-01-01T00:00:00.000Z',
        year: 2025,
        month: 1,
        amount: 300_000,
      }),
      createEvent({
        sequence: 2,
        eventType: 'EXPENSE',
        eventDate: '2025-01-10T12:00:00.000Z',
        year: 2025,
        month: 1,
        amount: 100_000,
      }),
      createEvent({
        sequence: 3,
        eventType: 'BUDGET_ADJUSTMENT_INCREASE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        amount: 50_000,
      }),
    ]);

    const budget = await eventService.calculateMonthlyBudget(2025, 1);

    expect(budget.budgetIn).toBe(350_000); // 300,000 + 50,000
    expect(budget.totalSpent).toBe(100_000);
    expect(budget.balance).toBe(250_000);
  });
});

describe('eventService createLocalEvent', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('should create event with negative temp sequence', async () => {
    const event = await eventService.createLocalEvent({
      eventType: 'EXPENSE',
      eventDate: new Date().toISOString(),
      year: 2025,
      month: 1,
      authorName: '홍길동',
      amount: 50_000,
      storeName: '맛있는 식당',
    });

    expect(event.sequence).toBeLessThan(0);
    expect(event.isLocalOnly).toBe(true);
    expect(event.syncState).toBe('pending');
  });
});

describe('eventService clearAll', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('should clear all data', async () => {
    await eventService.saveEvents([
      createEvent({
        sequence: 1,
        eventType: 'BUDGET_IN',
        eventDate: '2025-01-01T00:00:00.000Z',
        year: 2025,
        month: 1,
        amount: 300_000,
      }),
    ]);

    await eventService.updateLastSequence(1);

    await eventService.clearAll();

    const events = await eventService.getEventsByMonth(2025, 1);
    const lastSequence = await eventService.getLatestSequence();

    expect(events).toHaveLength(0);
    expect(lastSequence).toBe(0);
  });
});
