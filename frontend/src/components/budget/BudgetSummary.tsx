import { useCurrentBudget } from '../../hooks/useBudget';
import { formatCurrency } from '../../utils/format';

export default function BudgetSummary() {
  const budget = useCurrentBudget();

  // useLiveQuery returns undefined while loading
  if (!budget) {
    return (
      <div className="card animate-pulse border border-white/10">
        <div className="h-8 bg-white/10 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-white/10 rounded"></div>
      </div>
    );
  }

  const balance = budget.balance;
  const totalBudget = budget.totalBudget;
  const carriedAmount = budget.carriedAmount;
  const totalSpent = budget.totalSpent;
  const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-primary-500';
  };

  const progressColor = getProgressColor(percentage);

  return (
    <div className="card">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-1">이번 달 남은 예산</h2>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold ${balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}
            >
              {formatCurrency(balance)}
            </span>
            <span className="text-gray-500 font-medium">원</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-1">총 예산</div>
          <div className="font-medium text-gray-900">
            {formatCurrency(totalBudget)}원
            {carriedAmount !== 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                이월 {carriedAmount > 0 ? '+' : ''}
                {formatCurrency(carriedAmount)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative pt-1">
        <div className="flex mb-2 items-center justify-between">
          <div className="text-xs font-medium text-gray-500">사용률 {percentage.toFixed(1)}%</div>
          <div className="text-xs font-medium text-gray-500">
            지출 {formatCurrency(totalSpent)}원
          </div>
        </div>
        <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-gray-100">
          <div
            style={{ width: `${Math.min(percentage, 100)}%` }}
            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center rounded-full ${progressColor}`}
          ></div>
        </div>
      </div>

      {/* Warning Messages */}
      {percentage >= 100 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
          <span className="text-xl">🚨</span>
          <div>
            <p className="text-sm font-bold text-red-800">예산 초과!</p>
            <p className="text-xs text-red-600 mt-0.5">
              이번 달 예산을 모두 사용했습니다. 추가 지출을 자제해주세요.
            </p>
          </div>
        </div>
      )}
      {percentage >= 80 && percentage < 100 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-bold text-yellow-800">예산 소진 임박</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              예산의 80% 이상을 사용했습니다. 지출 관리에 유의해주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
