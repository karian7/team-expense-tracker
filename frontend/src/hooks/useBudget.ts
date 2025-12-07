import { useLiveQuery } from 'dexie-react-hooks';
import { budgetService } from '../services/local/budgetService';

export function useCurrentBudget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return useLiveQuery(() => budgetService.getMonthlyBudget(year, month), [year, month]);
}

export function useBudgetByMonth(year: number, month: number) {
  return useLiveQuery(() => {
    if (!year || !month) return undefined;
    return budgetService.getOrCreateMonthlyBudget(year, month);
  }, [year, month]);
}

export function useUpdateBudgetBaseAmount() {
  return {
    mutateAsync: async ({
      year,
      month,
      baseAmount,
    }: {
      year: number;
      month: number;
      baseAmount: number;
    }) => {
      return budgetService.updateMonthlyBudgetBaseAmount(year, month, baseAmount);
    },
    mutate: ({ year, month, baseAmount }: { year: number; month: number; baseAmount: number }) => {
      budgetService.updateMonthlyBudgetBaseAmount(year, month, baseAmount);
    },
  };
}

export function useAdjustCurrentBudget() {
  return {
    mutateAsync: async ({
      targetBalance,
      description,
    }: {
      targetBalance: number;
      description: string;
    }) => {
      return budgetService.adjustCurrentBudget(targetBalance, description);
    },
    mutate: ({ targetBalance, description }: { targetBalance: number; description: string }) => {
      budgetService.adjustCurrentBudget(targetBalance, description);
    },
  };
}
