import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncService } from './syncService';
import { eventService } from '../local/eventService';
import { pendingEventService } from '../local/pendingEventService';
import { eventApi, settingsApi } from '../api';
import { db } from '../db/database';

// Mock API 호출
vi.mock('../api', () => ({
  eventApi: {
    createEvent: vi.fn(),
    sync: vi.fn(),
  },
  settingsApi: {
    get: vi.fn(),
  },
}));

describe('syncService - BUDGET_RESET and Sequence Reassignment', () => {
  beforeEach(async () => {
    // 테스트 전에 DB 초기화
    await db.delete();
    await db.open();
    vi.clearAllMocks();

    // eventApi.createEvent mock 기본 설정 (pending push 시 서버 응답)
    vi.mocked(eventApi.createEvent).mockImplementation(async (payload) => ({
      sequence: Date.now(), // 임시 sequence
      eventType: payload.eventType,
      eventDate: payload.eventDate,
      year: payload.year,
      month: payload.month,
      authorName: payload.authorName,
      amount: payload.amount,
      storeName: payload.storeName ?? null,
      description: payload.description ?? null,
      receiptImage: payload.receiptImage ?? null,
      ocrRawData: payload.ocrRawData ?? null,
      referenceSequence: payload.referenceSequence ?? null,
      createdAt: new Date().toISOString(),
    }));
  });

  describe('BUDGET_RESET 필터링', () => {
    it('BUDGET_RESET 이후의 이벤트만 계산해야 함', async () => {
      // Given: BUDGET_RESET 이전 이벤트들
      await eventService.saveEvents([
        {
          sequence: 1,
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: 300000,
          storeName: null,
          description: '기본 월별 예산',
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          sequence: 2,
          eventType: 'EXPENSE',
          eventDate: '2025-01-05T00:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User A',
          amount: 50000,
          storeName: '식당',
          description: '팀 회식',
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: '2025-01-05T00:00:00.000Z',
        },
      ]);

      // When: BUDGET_RESET 이벤트와 새 BUDGET_IN 저장
      await eventService.saveEvents([
        {
          sequence: 100,
          eventType: 'BUDGET_RESET',
          eventDate: '2025-01-10T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: 0,
          storeName: null,
          description: '데이터 초기화',
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: '2025-01-10T12:00:00.000Z',
        },
        {
          sequence: 101,
          eventType: 'BUDGET_IN',
          eventDate: '2025-01-01T00:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'SYSTEM',
          amount: 500000,
          storeName: null,
          description: '기본 월별 예산',
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: '2025-01-10T12:00:00.000Z',
        },
      ]);

      // Then: BUDGET_RESET 이후의 이벤트만 계산됨
      const budget = await eventService.calculateMonthlyBudget(2025, 1);
      expect(budget.budgetIn).toBe(500000); // 101번만
      expect(budget.totalSpent).toBe(0); // 2번 expense는 무시됨
      expect(budget.balance).toBe(500000);
    });
  });

  describe('시간 기반 pending 필터링', () => {
    it('BUDGET_RESET 이전 pending은 삭제, 이후는 유지해야 함', async () => {
      // Given: 리셋 이전과 이후 pending 이벤트
      const resetDate = new Date('2025-01-10T12:00:00.000Z');
      const beforeResetDate = new Date('2025-01-10T11:50:00.000Z');
      const afterResetDate = new Date('2025-01-10T12:05:00.000Z');

      // 리셋 이전 pending (retryCount를 10으로 설정하여 push 건너뛰기)
      const pending1 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: beforeResetDate.toISOString(),
          year: 2025,
          month: 1,
          authorName: 'User A',
          amount: 30000,
          description: '리셋 이전 지출',
        },
        -1000
      );
      // createdAt을 리셋 이전 시간으로 설정
      await db.pendingEvents.update(pending1.id, {
        retryCount: 10,
        createdAt: beforeResetDate.toISOString(),
      });
      await eventService.saveEvent({
        sequence: -1000,
        eventType: 'EXPENSE',
        eventDate: beforeResetDate.toISOString(),
        year: 2025,
        month: 1,
        authorName: 'User A',
        amount: 30000,
        storeName: null,
        description: '리셋 이전 지출',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: beforeResetDate.toISOString(),
        isLocalOnly: true,
        syncState: 'pending',
        pendingId: pending1.id,
      });

      // 리셋 이후 pending (retryCount를 10으로 설정하여 push 건너뛰기)
      const pending2 = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: afterResetDate.toISOString(),
          year: 2025,
          month: 1,
          authorName: 'User B',
          amount: 40000,
          description: '리셋 이후 지출',
        },
        -2000
      );
      // createdAt을 리셋 이후 시간으로 설정
      await db.pendingEvents.update(pending2.id, {
        retryCount: 10,
        createdAt: afterResetDate.toISOString(),
      });
      await eventService.saveEvent({
        sequence: -2000,
        eventType: 'EXPENSE',
        eventDate: afterResetDate.toISOString(),
        year: 2025,
        month: 1,
        authorName: 'User B',
        amount: 40000,
        storeName: null,
        description: '리셋 이후 지출',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: afterResetDate.toISOString(),
        isLocalOnly: true,
        syncState: 'pending',
        pendingId: pending2.id,
      });

      // Mock API 응답
      vi.mocked(settingsApi.get).mockResolvedValue({
        defaultMonthlyBudget: 500000,
        initialBudget: 500000,
        needsFullSync: false,
      });

      vi.mocked(eventApi.sync).mockResolvedValue({
        events: [
          {
            sequence: 100,
            eventType: 'BUDGET_RESET',
            eventDate: resetDate.toISOString(),
            year: 2025,
            month: 1,
            authorName: 'SYSTEM',
            amount: 0,
            storeName: null,
            description: '데이터 초기화',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: resetDate.toISOString(),
          },
          {
            sequence: 101,
            eventType: 'BUDGET_IN',
            eventDate: '2025-01-01T00:00:00.000Z',
            year: 2025,
            month: 1,
            authorName: 'SYSTEM',
            amount: 500000,
            storeName: null,
            description: '기본 월별 예산',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: resetDate.toISOString(),
          },
        ],
        lastSequence: 101,
        needsFullSync: false,
      });

      // When: 동기화 실행
      await syncService.sync();

      // Then: 리셋 이전 pending 삭제, 이후는 유지
      const remainingPending = await pendingEventService.getAll();
      expect(remainingPending.length).toBe(1);
      expect(remainingPending[0].payload.description).toBe('리셋 이후 지출');

      // budgetEvents도 확인
      const budgetEvent = await db.budgetEvents.get(-1000);
      expect(budgetEvent).toBeUndefined(); // 리셋 이전 이벤트 삭제됨
    });
  });

  describe('Sequence 재할당 (로컬 퍼스트)', () => {
    it('남은 pending 이벤트의 sequence를 서버 최신 다음으로 재할당해야 함', async () => {
      // Given: pending 이벤트와 서버 이벤트 (retryCount 10으로 push 건너뛰기)
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: 'User A',
          amount: 30000,
          description: 'Pending 지출',
        },
        -1000
      );
      await db.pendingEvents.update(pending.id, { retryCount: 10 });
      await eventService.saveEvent({
        sequence: -1000,
        eventType: 'EXPENSE',
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: 'User A',
        amount: 30000,
        storeName: null,
        description: 'Pending 지출',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: '2025-01-15T12:00:00.000Z',
        isLocalOnly: true,
        syncState: 'pending',
        pendingId: pending.id,
      });

      // Mock API 응답
      vi.mocked(eventApi.sync).mockResolvedValue({
        events: [
          {
            sequence: 100,
            eventType: 'BUDGET_IN',
            eventDate: '2025-01-01T00:00:00.000Z',
            year: 2025,
            month: 1,
            authorName: 'SYSTEM',
            amount: 300000,
            storeName: null,
            description: '기본 월별 예산',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            sequence: 101,
            eventType: 'EXPENSE',
            eventDate: '2025-01-05T00:00:00.000Z',
            year: 2025,
            month: 1,
            authorName: 'User B',
            amount: 50000,
            storeName: null,
            description: '다른 사용자 지출',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: '2025-01-05T00:00:00.000Z',
          },
          {
            sequence: 102,
            eventType: 'EXPENSE',
            eventDate: '2025-01-06T00:00:00.000Z',
            year: 2025,
            month: 1,
            authorName: 'User C',
            amount: 60000,
            storeName: null,
            description: '또 다른 지출',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: '2025-01-06T00:00:00.000Z',
          },
        ],
        lastSequence: 102,
        needsFullSync: false,
      });

      // When: 동기화 실행
      await syncService.sync();

      // Then: pending sequence가 103으로 재할당됨
      const remainingPending = await pendingEventService.getAll();
      expect(remainingPending.length).toBe(1);
      expect(remainingPending[0].tempSequence).toBe(103);

      // budgetEvents에서도 확인
      const oldEvent = await db.budgetEvents.get(-1000);
      expect(oldEvent).toBeUndefined(); // 기존 tempSequence 삭제됨

      const newEvent = await db.budgetEvents.get(103);
      expect(newEvent).toBeDefined();
      expect(newEvent?.description).toBe('Pending 지출');
      expect(newEvent?.amount).toBe(30000);
    });

    it('여러 pending 이벤트를 순차적으로 재할당해야 함', async () => {
      // Given: 3개의 pending 이벤트 (retryCount 10으로 push 건너뛰기)
      for (let i = 0; i < 3; i++) {
        const pending = await pendingEventService.enqueue(
          {
            eventType: 'EXPENSE',
            eventDate: `2025-01-${15 + i}T12:00:00.000Z`,
            year: 2025,
            month: 1,
            authorName: `User ${i}`,
            amount: 10000 * (i + 1),
            description: `Pending ${i + 1}`,
          },
          -1000 - i
        );
        await db.pendingEvents.update(pending.id, { retryCount: 10 });
        await eventService.saveEvent({
          sequence: -1000 - i,
          eventType: 'EXPENSE',
          eventDate: `2025-01-${15 + i}T12:00:00.000Z`,
          year: 2025,
          month: 1,
          authorName: `User ${i}`,
          amount: 10000 * (i + 1),
          storeName: null,
          description: `Pending ${i + 1}`,
          receiptImage: null,
          ocrRawData: null,
          referenceSequence: null,
          createdAt: `2025-01-${15 + i}T12:00:00.000Z`,
          isLocalOnly: true,
          syncState: 'pending',
          pendingId: pending.id,
        });
      }

      // Mock API 응답 (서버 최신 sequence: 100)
      vi.mocked(eventApi.sync).mockResolvedValue({
        events: [
          {
            sequence: 100,
            eventType: 'BUDGET_IN',
            eventDate: '2025-01-01T00:00:00.000Z',
            year: 2025,
            month: 1,
            authorName: 'SYSTEM',
            amount: 300000,
            storeName: null,
            description: '기본 월별 예산',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        lastSequence: 100,
        needsFullSync: false,
      });

      // When: 동기화 실행
      await syncService.sync();

      // Then: pending이 101, 102, 103으로 재할당됨
      const events = await db.budgetEvents.where('sequence').above(100).sortBy('sequence');
      expect(events.length).toBe(3);
      expect(events[0].sequence).toBe(101);
      expect(events[0].description).toBe('Pending 1');
      expect(events[1].sequence).toBe(102);
      expect(events[1].description).toBe('Pending 2');
      expect(events[2].sequence).toBe(103);
      expect(events[2].description).toBe('Pending 3');
    });
  });

  describe('복합 시나리오: BUDGET_RESET + Sequence 재할당', () => {
    it('BUDGET_RESET 이후 pending을 유지하고 sequence 재할당해야 함', async () => {
      const resetDate = new Date('2025-01-10T12:00:00.000Z');
      const afterResetDate = new Date('2025-01-10T12:05:00.000Z');

      // Given: 리셋 이후 pending 이벤트 (retryCount 10으로 push 건너뛰기)
      const pending = await pendingEventService.enqueue(
        {
          eventType: 'EXPENSE',
          eventDate: afterResetDate.toISOString(),
          year: 2025,
          month: 1,
          authorName: 'User A',
          amount: 40000,
          description: '리셋 이후 지출',
        },
        -2000
      );
      await db.pendingEvents.update(pending.id, { retryCount: 10 });
      await eventService.saveEvent({
        sequence: -2000,
        eventType: 'EXPENSE',
        eventDate: afterResetDate.toISOString(),
        year: 2025,
        month: 1,
        authorName: 'User A',
        amount: 40000,
        storeName: null,
        description: '리셋 이후 지출',
        receiptImage: null,
        ocrRawData: null,
        referenceSequence: null,
        createdAt: afterResetDate.toISOString(),
        isLocalOnly: true,
        syncState: 'pending',
        pendingId: pending.id,
      });

      // Mock API 응답
      vi.mocked(settingsApi.get).mockResolvedValue({
        defaultMonthlyBudget: 500000,
        initialBudget: 500000,
        needsFullSync: false,
      });

      vi.mocked(eventApi.sync).mockResolvedValue({
        events: [
          {
            sequence: 100,
            eventType: 'BUDGET_RESET',
            eventDate: resetDate.toISOString(),
            year: 2025,
            month: 1,
            authorName: 'SYSTEM',
            amount: 0,
            storeName: null,
            description: '데이터 초기화',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: resetDate.toISOString(),
          },
          {
            sequence: 101,
            eventType: 'BUDGET_IN',
            eventDate: '2025-01-01T00:00:00.000Z',
            year: 2025,
            month: 1,
            authorName: 'SYSTEM',
            amount: 500000,
            storeName: null,
            description: '기본 월별 예산',
            receiptImage: null,
            ocrRawData: null,
            referenceSequence: null,
            createdAt: resetDate.toISOString(),
          },
        ],
        lastSequence: 101,
        needsFullSync: false,
      });

      // When: 동기화 실행
      await syncService.sync();

      // Then: pending이 유지되고 sequence 102로 재할당됨
      const remainingPending = await pendingEventService.getAll();
      expect(remainingPending.length).toBe(1);
      expect(remainingPending[0].tempSequence).toBe(102);
      expect(remainingPending[0].payload.description).toBe('리셋 이후 지출');

      // budgetEvents에서도 확인
      const reassignedEvent = await db.budgetEvents.get(102);
      expect(reassignedEvent).toBeDefined();
      expect(reassignedEvent?.description).toBe('리셋 이후 지출');

      // 잔액 계산 확인
      const budget = await eventService.calculateMonthlyBudget(2025, 1);
      expect(budget.budgetIn).toBe(500000); // BUDGET_IN
      expect(budget.totalSpent).toBe(40000); // 재할당된 pending 지출
      expect(budget.balance).toBe(460000);
    });
  });
});
