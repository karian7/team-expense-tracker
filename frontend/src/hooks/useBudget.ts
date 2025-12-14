import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { budgetService } from '../services/local/budgetService';
import { eventService } from '../services/local/eventService';
import { syncService } from '../services/sync/syncService';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';
import { useInitialSyncStatus } from './useInitialSyncStatus';

export function useCurrentBudget() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { isInitialSyncCompleted, waitForInitialSync } = useInitialSyncStatus();

  useEffect(() => {
    const ensureBudget = async () => {
      if (!isInitialSyncCompleted) {
        await waitForInitialSync();
      }
      await budgetService.ensureMonthlyBudget(year, month);
    };

    ensureBudget().catch((error) => {
      console.error('Failed to ensure monthly budget', error);
    });
  }, [year, month, isInitialSyncCompleted, waitForInitialSync]);

  return useLiveQuery(() => budgetService.getMonthlyBudget(year, month), [year, month]);
}

export function useBudgetByMonth(year: number, month: number) {
  const { isInitialSyncCompleted, waitForInitialSync } = useInitialSyncStatus();
  useEffect(() => {
    if (!year || !month) return;
    const ensureBudget = async () => {
      if (!isInitialSyncCompleted) {
        await waitForInitialSync();
      }
      await budgetService.ensureMonthlyBudget(year, month);
    };

    ensureBudget().catch((error) => {
      console.error('Failed to ensure monthly budget for period', error);
    });
  }, [year, month, isInitialSyncCompleted, waitForInitialSync]);

  return useLiveQuery(() => {
    if (!year || !month) return undefined;
    return budgetService.getMonthlyBudget(year, month);
  }, [year, month]);
}

export function useUpdateBudgetBaseAmount() {
  return { mutateAsync: async () => {} };
}

export function useAdjustCurrentBudget() {
  return {
    mutateAsync: async (params: { targetBalance: number; description: string }) => {
      const currentBudget = await budgetService.getCurrentBudget();
      const adjustment = params.targetBalance - currentBudget.balance;

      if (adjustment === 0) {
        return;
      }

      const payload = {
        eventType:
          adjustment > 0
            ? ('BUDGET_ADJUSTMENT_INCREASE' as const)
            : ('BUDGET_ADJUSTMENT_DECREASE' as const),
        eventDate: new Date().toISOString(),
        year: currentBudget.year,
        month: currentBudget.month,
        authorName: BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
        amount: Math.abs(adjustment),
        description: params.description?.trim() || '예산 조정',
      };

      await eventService.createLocalEvent(payload);

      try {
        await syncService.sync();
      } catch (error) {
        console.warn('Budget adjustment sync failed:', error);
      }
    },
  };
}
