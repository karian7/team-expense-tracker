import { useLiveQuery } from 'dexie-react-hooks';
import {
  expenseService,
  type CreateExpenseData,
  type UpdateExpenseData,
} from '../services/local/expenseService';

export function useExpenses(params?: { year?: number; month?: number; authorName?: string }) {
  return useLiveQuery(() => expenseService.getExpenses(params || {}), [params]);
}

export function useExpense(id: string) {
  return useLiveQuery(() => {
    if (!id) return undefined;
    return expenseService.getExpenseById(id);
  }, [id]);
}

export function useCreateExpense() {
  return {
    mutateAsync: async (data: CreateExpenseData) => {
      return expenseService.createExpense(data);
    },
    mutate: (data: CreateExpenseData) => {
      expenseService.createExpense(data);
    },
  };
}

export function useUpdateExpense() {
  return {
    mutateAsync: async ({ id, updates }: { id: string; updates: UpdateExpenseData }) => {
      return expenseService.updateExpense(id, updates);
    },
    mutate: ({ id, updates }: { id: string; updates: UpdateExpenseData }) => {
      expenseService.updateExpense(id, updates);
    },
  };
}

export function useDeleteExpense() {
  return {
    mutateAsync: async (id: string) => {
      return expenseService.deleteExpense(id);
    },
    mutate: (id: string) => {
      expenseService.deleteExpense(id);
    },
  };
}
