import { useLiveQuery } from 'dexie-react-hooks';
import { expenseService } from '../services/local/expenseService';
import type { ExpenseFormData } from '../types';
import { expenseApi } from '../services/api';

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
      return expenseApi.create(data);
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
    mutateAsync: async (sequence: number) => {
      return expenseApi.delete(sequence.toString());
    },
  };
}
