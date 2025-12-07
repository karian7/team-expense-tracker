import { useLiveQuery } from 'dexie-react-hooks';
import { settingsService } from '../services/local/settingsService';

export function useAppSettings() {
  return useLiveQuery(async () => {
    const defaultBudget = await settingsService.getDefaultMonthlyBudget();
    return {
      defaultMonthlyBudget: defaultBudget,
      initialBudget: defaultBudget,
    };
  });
}

export function useUpdateDefaultMonthlyBudget() {
  return {
    mutateAsync: async (amount: number) => {
      // 로컬 설정 저장
      await settingsService.setDefaultMonthlyBudget(amount);
      // 백엔드 설정도 업데이트
      const { settingsApi } = await import('../services/api');
      await settingsApi.update({ defaultMonthlyBudget: amount });
    },
  };
}

export function useResetAllData() {
  return {
    mutateAsync: async (initialBudget: number) => {
      const { settingsApi, budgetApi } = await import('../services/api');
      const { syncService } = await import('../services/sync/syncService');

      // 1. 백엔드 초기화 (모든 이벤트 삭제 + 초기 예산 설정)
      await settingsApi.setInitialBudget(initialBudget);

      // 2. 로컬 DB 초기화
      await settingsService.resetAll();

      // 3. 로컬 설정에 초기 예산 저장
      await settingsService.setDefaultMonthlyBudget(initialBudget);
      await settingsService.setInitialBudget(initialBudget);

      // 4. 현재 월 예산 자동 생성 (백엔드)
      await budgetApi.ensureCurrent();

      // 5. 백엔드와 동기화 (생성된 이벤트 가져오기)
      await syncService.sync();
    },
  };
}
