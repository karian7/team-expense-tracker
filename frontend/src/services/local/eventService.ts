import { db, type BudgetEvent } from '../db/database';

/**
 * 로컬 이벤트 조회
 */
export const eventService = {
  /**
   * 특정 월의 모든 이벤트 조회
   */
  async getEventsByMonth(year: number, month: number): Promise<BudgetEvent[]> {
    return db.budgetEvents.where('[year+month]').equals([year, month]).sortBy('sequence');
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
   */
  async calculateMonthlyBudget(year: number, month: number) {
    const events = await this.getEventsByMonth(year, month);

    let budgetIn = 0;
    let totalSpent = 0;

    events.forEach((event) => {
      if (event.eventType === 'BUDGET_IN') {
        budgetIn += event.amount;
      } else if (event.eventType === 'EXPENSE') {
        totalSpent += event.amount;
      }
    });

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
