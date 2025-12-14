import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/local/settingsService';
import { budgetService } from '../services/local/budgetService';
import { settingsApi } from '../services/api';
import { syncService } from '../services/sync/syncService';
import { pendingEventService } from '../services/local/pendingEventService';
import { eventService } from '../services/local/eventService';

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
 * 전체 데이터 초기화 (로컬 퍼스트)
 */
export function useResetAllData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (initialBudget: number) => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = new Date(year, month - 1, 1);

      // 1. 서버에 settings만 저장
      await settingsApi.setInitialBudget(initialBudget);

      // 2. 로컬 DB 완전 초기화
      await settingsService.resetAll();
      await pendingEventService.clearAll();

      // 3. 로컬 settings 저장
      await settingsService.setInitialBudget(initialBudget);
      await settingsService.setDefaultMonthlyBudget(initialBudget);

      // 4. 로컬에서 BUDGET_RESET 이벤트 생성 (pendingEvents에 추가)
      await eventService.createLocalEvent({
        eventType: 'BUDGET_RESET',
        eventDate: now.toISOString(),
        year,
        month,
        authorName: 'SYSTEM',
        amount: 0,
        description: `데이터 초기화 (${now.toISOString()})`,
      });

      // 5. 로컬에서 BUDGET_IN 이벤트 생성 (pendingEvents에 추가)
      await eventService.createLocalEvent({
        eventType: 'BUDGET_IN',
        eventDate: monthStart.toISOString(),
        year,
        month,
        authorName: 'SYSTEM',
        amount: initialBudget,
        description: '기본 월별 예산',
      });

      // 6. 동기화 (로컬 이벤트를 서버로 전송)
      await syncService.sync();
    },
    onSuccess: () => {
      // 모든 쿼리 캐시 무효화
      queryClient.invalidateQueries();
    },
  });
}

/**
 * Full Sync 필요 플래그 조회 (서버에서 가져오기)
 */
export function useNeedsFullSync() {
  return useQuery({
    queryKey: ['settings', 'needsFullSync'],
    queryFn: async () => {
      const settings = await settingsApi.get();
      return settings.needsFullSync;
    },
    staleTime: 0, // 항상 최신 상태 확인
  });
}

/**
 * Full Sync 실행
 */
export function useFullSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return syncService.fullSync();
    },
    onSuccess: () => {
      // needsFullSync 플래그 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['settings', 'needsFullSync'] });
    },
  });
}

/**
 * Full Sync 무시
 */
export function useIgnoreFullSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await syncService.ignoreFullSync();
    },
    onSuccess: () => {
      // needsFullSync 플래그 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['settings', 'needsFullSync'] });
    },
  });
}
