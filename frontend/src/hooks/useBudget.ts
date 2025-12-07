import { useLiveQuery } from 'dexie-react-hooks';
import { budgetService } from '../services/local/budgetService';
import { budgetApi } from '../services/api';
import { syncService } from '../services/sync/syncService';

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
  return { mutateAsync: async () => {} };
}

export function useAdjustCurrentBudget() {
  return {
    mutateAsync: async (params: { targetBalance: number; description: string }) => {
      // 백엔드 API 호출
      await budgetApi.adjustCurrent(params.targetBalance, params.description);
      // 동기화하여 로컬 DB 업데이트
      await syncService.sync();
    },
  };
}
