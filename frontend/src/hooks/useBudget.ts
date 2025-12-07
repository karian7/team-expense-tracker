import { useLiveQuery } from 'dexie-react-hooks';
import { budgetService } from '../services/local/budgetService';

export function useCurrentBudget() {
  return useLiveQuery(() => budgetService.getCurrentMonthlyBudget());
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
