import { useLiveQuery } from 'dexie-react-hooks';
import { expenseService } from '../services/local/expenseService';
import { eventService } from '../services/local/eventService';
import type { ExpenseFormData } from '../types';
import { syncService } from '../services/sync/syncService';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';

export function useExpenses(params?: { year?: number; month?: number }) {
  return useLiveQuery(async () => {
    if (!params?.year || !params?.month) return [];
    return expenseService.getExpensesByMonth(params.year, params.month);
  }, [params?.year, params?.month]);
}

export function useExpenseById(sequence: number) {
  return useLiveQuery(() => expenseService.getExpenseById(sequence), [sequence]);
}

export function useCreateExpense() {
  return {
    mutateAsync: async (data: ExpenseFormData) => {
      const eventDate = new Date(data.expenseDate);

      if (Number.isNaN(eventDate.getTime())) {
        throw new Error('유효하지 않은 지출 일자입니다.');
      }

      const payload = {
        eventType: 'EXPENSE' as const,
        eventDate: eventDate.toISOString(),
        year: eventDate.getFullYear(),
        month: eventDate.getMonth() + 1,
        authorName: data.authorName.trim(),
        amount: data.amount,
        storeName: data.storeName?.trim(),
        description: data.description?.trim(),
        receiptImage: data.receiptImage,
        ocrRawData: data.ocrRawData,
      };

      const localEvent = await eventService.createLocalEvent(payload);

      try {
        await syncService.sync();
      } catch (error) {
        console.warn('Sync after creating expense failed:', error);
      }

      return localEvent;
    },
  };
}

export function useUpdateExpense() {
  return {
    mutateAsync: async () => {
      throw new Error('Update not supported');
    },
  };
}

export function useDeleteExpense() {
  return {
    mutateAsync: async (params: {
      sequence: number;
      description?: string;
      authorName?: string;
    }) => {
      const expense = await expenseService.getExpenseById(params.sequence);

      if (!expense) {
        throw new Error('삭제할 지출을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
      }

      const alreadyDeleted = await expenseService.isExpenseDeleted(expense.sequence);
      if (alreadyDeleted) {
        throw new Error('이미 삭제된 지출입니다.');
      }

      const label =
        params.description?.trim() ||
        expense.description ||
        expense.storeName ||
        `#${expense.sequence}`;

      const payload = {
        eventType: 'EXPENSE_REVERSAL' as const,
        eventDate: new Date().toISOString(),
        year: expense.year,
        month: expense.month,
        authorName: params.authorName?.trim() || BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
        amount: expense.amount,
        description: `지출 삭제: ${label}`,
        storeName: expense.storeName ?? undefined,
        referenceSequence: expense.sequence,
      };

      const localEvent = await eventService.createLocalEvent(payload);

      try {
        await syncService.sync();
      } catch (error) {
        console.warn('Expense deletion sync failed:', error);
      }

      return localEvent;
    },
  };
}
