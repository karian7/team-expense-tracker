import { db } from '../db/database';
import type { Expense } from '../../types';

const getDeletedExpenseSequences = (events: Expense[]): Set<number> => {
  return new Set(
    events
      .filter((event) => event.eventType === 'EXPENSE_REVERSAL' && event.referenceSequence)
      .map((event) => event.referenceSequence as number)
  );
};

export const expenseService = {
  async getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
    const events = await db.budgetEvents
      .where('[year+month]')
      .equals([year, month])
      .sortBy('eventDate');

    const deletedSequences = getDeletedExpenseSequences(events as Expense[]);
    return events.filter(
      (event) => event.eventType === 'EXPENSE' && !deletedSequences.has(event.sequence)
    ) as Expense[];
  },

  async getExpenseById(sequence: number): Promise<Expense | undefined> {
    const expense = await db.budgetEvents.get(sequence);
    if (!expense || expense.eventType !== 'EXPENSE') {
      return undefined;
    }

    const reversal = await db.budgetEvents.where('referenceSequence').equals(sequence).first();
    if (reversal && reversal.eventType === 'EXPENSE_REVERSAL') {
      return undefined;
    }

    return expense;
  },

  async isExpenseDeleted(sequence: number): Promise<boolean> {
    const reversal = await db.budgetEvents.where('referenceSequence').equals(sequence).first();
    return Boolean(reversal && reversal.eventType === 'EXPENSE_REVERSAL');
  },
};
