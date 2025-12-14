import { eventService } from './eventService';
import { BUDGET_EVENT_CONSTANTS } from '../../constants/budgetEvents';
import type { BudgetEvent, MonthlyBudget } from '../../types';
import { settingsApi } from '../api';
import { settingsService } from './settingsService';

const isSystemMonthlyBudgetEvent = (event: BudgetEvent) =>
  event.eventType === 'BUDGET_IN' &&
  event.authorName === BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR &&
  event.description === BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION;

const ensureMonthlyBudgetTasks = new Map<string, Promise<boolean>>();

async function ensureMonthlyBudgetEvent(year: number, month: number): Promise<boolean> {
  const key = `${year}-${month}`;
  const existingTask = ensureMonthlyBudgetTasks.get(key);

  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const initialSyncCompleted = await settingsService.isInitialSyncCompleted();

    if (!initialSyncCompleted) {
      console.warn(
        `[BudgetService] Skip monthly budget creation for ${year}-${month} until initial sync completes.`
      );
      return false;
    }

    const events = await eventService.getEventsByMonth(year, month);
    const hasMonthlyBudget = events.some(isSystemMonthlyBudgetEvent);

    if (hasMonthlyBudget) {
      return false;
    }

    // 🔄 서버에서 default_monthly_budget 가져오기 (정합성 보장)
    let defaultBudget = 0;
    try {
      defaultBudget = await settingsApi.getDefaultMonthlyBudget();
    } catch (error) {
      console.warn('[BudgetService] Failed to fetch default monthly budget from server:', error);
      // 서버에서 못 가져온 경우 월 예산 생성 지연
      return false;
    }

    if (defaultBudget <= 0) {
      return false;
    }

    await eventService.createLocalEvent({
      eventType: 'BUDGET_IN',
      eventDate: new Date(year, month - 1, 1).toISOString(),
      year,
      month,
      authorName: BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
      amount: defaultBudget,
      description: BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION,
    });

    return true;
  })().finally(() => {
    ensureMonthlyBudgetTasks.delete(key);
  });

  ensureMonthlyBudgetTasks.set(key, task);
  return task;
}

export const budgetService = {
  async getMonthlyBudget(year: number, month: number): Promise<MonthlyBudget> {
    return eventService.calculateMonthlyBudget(year, month);
  },

  async getOrCreateMonthlyBudget(year: number, month: number): Promise<MonthlyBudget> {
    await ensureMonthlyBudgetEvent(year, month);
    return this.getMonthlyBudget(year, month);
  },

  async getCurrentBudget(): Promise<MonthlyBudget> {
    const now = new Date();
    return this.getOrCreateMonthlyBudget(now.getFullYear(), now.getMonth() + 1);
  },

  async ensureMonthlyBudget(year: number, month: number): Promise<boolean> {
    return ensureMonthlyBudgetEvent(year, month);
  },
};
