import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../services/api';
import type { AppSettings } from '../types';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
    staleTime: 60000, // 1 minute
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<AppSettings>) => settingsApi.update(settings),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}

export function useSetInitialBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (initialBudget: number) => settingsApi.setInitialBudget(initialBudget),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      // 모든 데이터가 리셋되므로 모든 쿼리 무효화
      queryClient.invalidateQueries();
    },
  });
}
