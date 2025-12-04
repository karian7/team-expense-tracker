import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from '../services/api';

export function useCurrentBudget() {
  return useQuery({
    queryKey: ['budget', 'current'],
    queryFn: () => budgetApi.getCurrent(),
    staleTime: 30000, // 30 seconds
  });
}

export function useBudgetByMonth(year: number, month: number) {
  return useQuery({
    queryKey: ['budget', year, month],
    queryFn: () => budgetApi.getByMonth(year, month),
    enabled: !!year && !!month,
  });
}

export function useUpdateBudgetBaseAmount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      year,
      month,
      baseAmount,
    }: {
      year: number;
      month: number;
      baseAmount: number;
    }) => budgetApi.updateBaseAmount(year, month, baseAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}
