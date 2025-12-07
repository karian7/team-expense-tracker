import { eventService } from './eventService';
import type { MonthlyBudget } from '../../types';

export const budgetService = {
  async getMonthlyBudget(year: number, month: number): Promise<MonthlyBudget> {
    return eventService.calculateMonthlyBudget(year, month);
  },

  async getOrCreateMonthlyBudget(year: number, month: number): Promise<MonthlyBudget> {
    return this.getMonthlyBudget(year, month);
  },

  async getCurrentBudget(): Promise<MonthlyBudget> {
    const now = new Date();
    return this.getMonthlyBudget(now.getFullYear(), now.getMonth() + 1);
  },
};
