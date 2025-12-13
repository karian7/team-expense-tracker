import { eventService } from './eventService';
import type {
  MonthlyReport,
  MonthlyReportStatistics,
  DailyBreakdown,
  AuthorBreakdown,
  BudgetEvent,
} from '../../types';

/**
 * 로컬 이벤트로부터 월별 리포트 생성 (Event Sourcing)
 */
export const reportService = {
  /**
   * 특정 월의 리포트 생성
   */
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const events = await eventService.getEventsByMonth(year, month);
    const budget = await eventService.calculateMonthlyBudget(year, month);

    // EXPENSE 타입만 필터링 (지출 통계)
    const expenseEvents = events.filter((e) => e.eventType === 'EXPENSE');

    const statistics = this.calculateStatistics(expenseEvents);

    return {
      budget,
      statistics,
    };
  },

  /**
   * 지출 이벤트로부터 통계 계산
   */
  calculateStatistics(expenseEvents: BudgetEvent[]): MonthlyReportStatistics {
    const totalExpenses = expenseEvents.reduce((sum, e) => sum + e.amount, 0);
    const expenseCount = expenseEvents.length;

    // 일별 집계
    const dailyMap = new Map<string, { amount: number; count: number }>();
    expenseEvents.forEach((expense) => {
      const date = expense.eventDate.split('T')[0]; // YYYY-MM-DD
      const existing = dailyMap.get(date) || { amount: 0, count: 0 };
      dailyMap.set(date, {
        amount: existing.amount + expense.amount,
        count: existing.count + 1,
      });
    });

    const dailyBreakdown: DailyBreakdown[] = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 작성자별 집계
    const authorMap = new Map<string, { amount: number; count: number }>();
    expenseEvents.forEach((expense) => {
      const existing = authorMap.get(expense.authorName) || { amount: 0, count: 0 };
      authorMap.set(expense.authorName, {
        amount: existing.amount + expense.amount,
        count: existing.count + 1,
      });
    });

    const authorBreakdown: AuthorBreakdown[] = Array.from(authorMap.entries())
      .map(([authorName, data]) => ({
        authorName,
        amount: data.amount,
        count: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 상위 5개 지출
    const topExpenses = [...expenseEvents].sort((a, b) => b.amount - a.amount).slice(0, 5);

    return {
      totalExpenses,
      expenseCount,
      dailyBreakdown,
      authorBreakdown,
      topExpenses,
    };
  },
};
