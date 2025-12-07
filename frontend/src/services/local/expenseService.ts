import { db } from '../db/database';
import type { Expense } from '../../types';

export const expenseService = {
  async getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
    const events = await db.budgetEvents
      .where('[year+month]')
      .equals([year, month])
      .and((e) => e.eventType === 'EXPENSE')
      .sortBy('eventDate');
    return events;
  },

  async getExpenseById(sequence: number): Promise<Expense | undefined> {
    return db.budgetEvents.get(sequence);
  },
};
