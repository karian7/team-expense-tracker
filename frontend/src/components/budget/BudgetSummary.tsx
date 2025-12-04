import { useCurrentBudget } from '../../hooks/useBudget';
import { formatCurrency, formatYearMonth } from '../../utils/format';

export default function BudgetSummary() {
  const { data: budget, isLoading, error } = useCurrentBudget();

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <p className="text-red-600">예산 정보를 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  if (!budget) return null;

  const balanceColor = budget.balance >= 0 ? 'text-green-600' : 'text-red-600';
  const progressPercentage = (budget.totalSpent / budget.totalBudget) * 100;

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-1">
          {formatYearMonth(budget.year, budget.month)}
        </h2>
        <p className="text-sm text-gray-500">회식비 잔액</p>
      </div>

      <div className="mb-6">
        <div className={`text-4xl font-bold ${balanceColor} mb-2`}>
          {formatCurrency(budget.balance)}
        </div>
        <div className="text-sm text-gray-600">
          {budget.carriedAmount > 0 && (
            <span className="mr-3">이월: {formatCurrency(budget.carriedAmount)}</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">총 예산</span>
          <span className="font-semibold">{formatCurrency(budget.totalBudget)}</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${
              progressPercentage > 100 ? 'bg-red-500' : 'bg-primary-600'
            }`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          ></div>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">사용액</span>
          <span className="font-semibold text-gray-900">{formatCurrency(budget.totalSpent)}</span>
        </div>

        {progressPercentage > 90 && progressPercentage <= 100 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ 예산의 {progressPercentage.toFixed(0)}%를 사용했습니다
            </p>
          </div>
        )}

        {progressPercentage > 100 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">❗ 예산을 초과했습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
