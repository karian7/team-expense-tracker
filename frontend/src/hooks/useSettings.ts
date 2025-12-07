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
    onSuccess: async () => {
      // 설정 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['settings'] });

      // 현재 월의 로컬 예산 이벤트 생성
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        await budgetService.ensureMonthlyBudget(year, month);
        // ensureMonthlyBudget 내부에서:
        // - 서버에서 defaultMonthlyBudget 조회
        // - 로컬 BUDGET_IN 이벤트 생성 (없는 경우만)
        // - useLiveQuery 자동 트리거
      } catch (error) {
        // 서버는 이미 업데이트됨 → 경고만 출력
        // 60초 후 자동 동기화로 최종 일관성 보장
        console.warn('[useSettings] 로컬 월별 예산 이벤트 생성 실패 (다음 동기화 시 복구):', error);
      }
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
