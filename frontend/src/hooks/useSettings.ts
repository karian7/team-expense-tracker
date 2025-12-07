import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/local/settingsService';
import { budgetService } from '../services/local/budgetService';
import { settingsApi } from '../services/api';

/**
 * 앱 설정 조회 (서버에서 가져오기)
 */
export function useAppSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      return settingsApi.get();
    },
    staleTime: 1000 * 60 * 5, // 5분 캐싱
  });
}

/**
 * 기본 월 예산 업데이트 (서버 우선)
 */
export function useUpdateDefaultMonthlyBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: number) => {
      // 서버에 저장 (원자성 보장)
      return settingsApi.update({ defaultMonthlyBudget: amount });
    },
    onSuccess: () => {
      // 설정 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

/**
 * 전체 데이터 초기화
 */
export function useResetAllData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (initialBudget: number) => {
      const { syncService } = await import('../services/sync/syncService');

      // 1. 백엔드 초기화 (모든 이벤트 삭제 + 초기 예산 설정)
      await settingsApi.setInitialBudget(initialBudget);

      // 2. 로컬 DB 초기화
      await settingsService.resetAll();

      // 3. 로컬 설정에 초기 예산 저장
      await settingsService.setInitialBudget(initialBudget);

      // 4. 현재 월 예산 로컬 생성 -> 동기화
      const now = new Date();
      await budgetService.ensureMonthlyBudget(now.getFullYear(), now.getMonth() + 1);

      // 5. 백엔드와 동기화 (로컬에서 생성한 이벤트 전달)
      await syncService.sync();
    },
    onSuccess: () => {
      // 모든 쿼리 캐시 무효화
      queryClient.invalidateQueries();
    },
  });
}
