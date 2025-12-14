import { db, now, type BudgetEvent, type SyncState } from '../db/database';
import type { CreateBudgetEventPayload } from '../../types';
import { pendingEventService } from './pendingEventService';

/**
 * 임시 sequence 생성 (충돌 확률 0%)
 * - 음수로 서버 sequence와 구분
 * - Crypto API 기반 32비트 난수
 */
const createTempSequence = (): number => {
  // 구형 브라우저 fallback
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    console.warn('[EventService] Crypto API not supported, using fallback');
    return -1 * (Date.now() * 1000000 + Math.floor(Math.random() * 1000000));
  }

  // 고정밀 타임스탬프 (마이크로초)
  const timestamp = Date.now() * 1000000;

  // Crypto 난수 (32비트)
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);

  return -1 * (timestamp + randomBytes[0]);
};

const INCOMING_EVENT_TYPES = new Set<BudgetEvent['eventType']>([
  'BUDGET_IN',
  'BUDGET_ADJUSTMENT_INCREASE',
]);

const OUTGOING_EVENT_TYPES = new Set<BudgetEvent['eventType']>([
  'EXPENSE',
  'BUDGET_ADJUSTMENT_DECREASE',
]);

/**
 * 로컬 이벤트 조회
 */
export const eventService = {
  /**
   * 가장 최근의 BUDGET_RESET 이벤트 조회
   */
  async getLatestResetEvent(): Promise<BudgetEvent | null> {
    const resetEvents = await db.budgetEvents.where('eventType').equals('BUDGET_RESET').toArray();

    if (resetEvents.length === 0) {
      return null;
    }

    resetEvents.sort((a, b) => {
      const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }

      const eventDateDiff = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      if (eventDateDiff !== 0) {
        return eventDateDiff;
      }

      return a.sequence - b.sequence;
    });

    return resetEvents[resetEvents.length - 1];
  },

  /**
   * 특정 월의 모든 이벤트 조회
   */
  async getEventsByMonth(year: number, month: number): Promise<BudgetEvent[]> {
    const [events, resetEvent] = await Promise.all([
      db.budgetEvents.where('[year+month]').equals([year, month]).sortBy('sequence'),
      this.getLatestResetEvent(),
    ]);

    if (!resetEvent) {
      return events;
    }

    const resetSequence = resetEvent.sequence;
    const resetCreatedAt = new Date(resetEvent.createdAt).getTime();
    const resetEventDate = new Date(resetEvent.eventDate).getTime();

    return events.filter((event) => {
      const eventCreatedAt = new Date(event.createdAt).getTime();
      const eventDate = new Date(event.eventDate).getTime();

      if (resetSequence >= 0 && event.sequence > resetSequence) {
        return true;
      }

      if (!Number.isNaN(eventCreatedAt) && eventCreatedAt > resetCreatedAt) {
        return true;
      }

      if (eventDate > resetEventDate) {
        return true;
      }

      if (eventDate === resetEventDate && event.sequence > resetSequence) {
        return true;
      }

      return false;
    });
  },

  /**
   * 특정 sequence 이후의 이벤트 조회 (동기화용)
   */
  async getEventsSince(sequence: number): Promise<BudgetEvent[]> {
    return db.budgetEvents.where('sequence').above(sequence).sortBy('sequence');
  },

  /**
   * 최신 sequence 조회
   */
  async getLatestSequence(): Promise<number> {
    const metadata = await db.syncMetadata.get('lastSequence');
    return metadata?.value || 0;
  },

  /**
   * 가장 최근의 BUDGET_RESET 이벤트 sequence 조회
   */
  async getLatestResetSequence(): Promise<number> {
    const latestReset = await this.getLatestResetEvent();
    return latestReset ? latestReset.sequence : 0;
  },

  /**
   * 이벤트 저장 (서버에서 받은 이벤트)
   */
  async saveEvent(event: BudgetEvent): Promise<void> {
    await db.budgetEvents.put(event);
  },

  /**
   * 여러 이벤트 일괄 저장
   */
  async saveEvents(events: BudgetEvent[]): Promise<void> {
    await db.budgetEvents.bulkPut(events);
  },

  async createLocalEvent(payload: CreateBudgetEventPayload): Promise<BudgetEvent> {
    const tempSequence = createTempSequence();
    console.log('[EventService] Creating local event with temp sequence:', tempSequence);
    const pending = await pendingEventService.enqueue(payload, tempSequence);
    const event: BudgetEvent = {
      sequence: tempSequence,
      eventType: payload.eventType,
      eventDate: payload.eventDate,
      year: payload.year,
      month: payload.month,
      authorName: payload.authorName,
      amount: payload.amount,
      storeName: payload.storeName ?? null,
      description: payload.description ?? null,
      receiptImage: payload.receiptImage ?? null,
      ocrRawData: payload.ocrRawData ? JSON.stringify(payload.ocrRawData) : null,
      referenceSequence: payload.referenceSequence ?? null,
      createdAt: now(),
      isLocalOnly: true,
      syncState: 'pending',
      pendingId: pending.id,
    };

    await db.budgetEvents.put(event);
    return event;
  },

  async markEventSyncState(sequence: number, state: SyncState): Promise<void> {
    await db.budgetEvents.update(sequence, { syncState: state });
  },

  async removeEvent(sequence: number): Promise<void> {
    await db.budgetEvents.delete(sequence);
  },

  /**
   * 마지막 동기화 sequence 업데이트
   */
  async updateLastSequence(sequence: number): Promise<void> {
    await db.syncMetadata.put({
      key: 'lastSequence',
      value: sequence,
      lastSyncTime: new Date().toISOString(),
    });
  },

  /**
   * 특정 월의 예산 계산 (클라이언트 사이드)
   * BUDGET_RESET 이벤트 이후의 데이터만 계산합니다.
   */
  async calculateMonthlyBudget(year: number, month: number) {
    // BUDGET_RESET 이후 이벤트만 포함된 월별 데이터 조회
    const events = await this.getEventsByMonth(year, month);

    let budgetIn = 0;
    let totalSpent = 0;

    events.forEach((event) => {
      if (INCOMING_EVENT_TYPES.has(event.eventType)) {
        budgetIn += event.amount;
      } else if (OUTGOING_EVENT_TYPES.has(event.eventType)) {
        totalSpent += event.amount;
      } else if (event.eventType === 'EXPENSE_REVERSAL') {
        totalSpent -= event.amount;
      }
    });

    if (totalSpent < 0) {
      totalSpent = 0;
    }

    // 이전 달 잔액 계산 (재귀)
    let previousBalance = 0;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const prevEvents = await this.getEventsByMonth(prevYear, prevMonth);

    if (prevEvents.length > 0) {
      const prevBudget = await this.calculateMonthlyBudget(prevYear, prevMonth);
      previousBalance = prevBudget.balance;
    }

    const totalBudget = previousBalance + budgetIn;
    const balance = totalBudget - totalSpent;

    return {
      year,
      month,
      budgetIn,
      previousBalance,
      totalBudget,
      totalSpent,
      balance,
      eventCount: events.length,
    };
  },

  /**
   * 모든 로컬 이벤트 삭제 (초기화)
   */
  async clearAll(): Promise<void> {
    await db.budgetEvents.clear();
    await db.syncMetadata.clear();
  },
};
