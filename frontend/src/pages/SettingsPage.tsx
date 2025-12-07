import { useState } from 'react';
import {
  useAppSettings,
  useUpdateDefaultMonthlyBudget,
  useResetAllData,
} from '../hooks/useSettings';
import { useCurrentBudget, useAdjustCurrentBudget } from '../hooks/useBudget';
import { formatCurrency } from '../utils/format';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const settings = useAppSettings();
  const currentBudget = useCurrentBudget();
  const updateMutation = useUpdateDefaultMonthlyBudget();
  const resetMutation = useResetAllData();
  const adjustBudgetMutation = useAdjustCurrentBudget();

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [newBudget, setNewBudget] = useState(0);
  const [targetBalance, setTargetBalance] = useState(0);
  const [adjustDescription, setAdjustDescription] = useState('');
  const [initialBudget, setInitialBudget] = useState(0);

  // Local mutation states
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleUpdateBudget = async () => {
    try {
      setIsUpdating(true);
      await updateMutation.mutateAsync(newBudget);
      setIsBudgetModalOpen(false);
      alert('예산이 변경되었습니다.');
    } catch (error) {
      console.error('Budget update error:', error);
      alert('예산 변경에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdjustBudget = async () => {
    if (!adjustDescription.trim()) {
      alert('조정 내용을 입력해주세요.');
      return;
    }

    if (targetBalance < 0) {
      alert('목표 잔액은 0원 이상이어야 합니다.');
      return;
    }

    try {
      setIsAdjusting(true);
      await adjustBudgetMutation.mutateAsync({
        targetBalance,
        description: adjustDescription.trim(),
      });
      setIsAdjustModalOpen(false);
      setAdjustDescription('');
      alert('이번달 예산이 조정되었습니다.');
    } catch (error) {
      console.error('Budget adjustment error:', error);

      // 백엔드에서 보낸 에러 메시지 추출
      let errorMessage = '예산 조정에 실패했습니다.';
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { error?: string } } }).response;
        if (response?.data?.error) {
          errorMessage = response.data.error;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleReset = async () => {
    if (initialBudget < 0) {
      alert('초기 예산은 0원 이상이어야 합니다.');
      return;
    }

    try {
      setIsResetting(true);
      await resetMutation.mutateAsync(initialBudget);
      setIsResetModalOpen(false);
      setInitialBudget(0);
      alert('모든 데이터가 초기화되었습니다.');
    } catch (error) {
      console.error('Reset error:', error);
      alert('초기화에 실패했습니다.');
    } finally {
      setIsResetting(false);
    }
  };

  // useQuery returns { data, isLoading, error }
  if (settings.isLoading || currentBudget.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!settings.data || !currentBudget.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">설정을 불러올 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 rounded-t-xl">
          <div className="px-6 h-14 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">설정</h1>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-900"
              data-testid="settings-close-button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="px-6 py-6 space-y-6">
          {/* Budget Settings */}
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">💰</span> 예산 설정
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">현재 월 예산</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(settings.data.defaultMonthlyBudget)}원
                  </p>
                </div>
                <button
                  onClick={() => {
                    setNewBudget(settings.data.defaultMonthlyBudget);
                    setIsBudgetModalOpen(true);
                  }}
                  className="btn-secondary text-sm py-1.5 px-3"
                  data-testid="change-monthly-budget-button"
                >
                  변경
                </button>
              </div>

              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div>
                  <p className="text-sm text-blue-600 font-medium">이번달 남은 예산</p>
                  <p className="text-xl font-bold text-blue-900">
                    {formatCurrency(currentBudget.data.balance)}원
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTargetBalance(currentBudget.data.balance);
                    setIsAdjustModalOpen(true);
                  }}
                  className="btn-primary text-sm py-1.5 px-3"
                  data-testid="adjust-budget-button"
                >
                  조정
                </button>
              </div>

              <div className="flex items-center gap-2 text-sm bg-blue-50 p-3 rounded-lg text-blue-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                예산 변경 시 다음 달부터 적용됩니다.
              </div>
            </div>
          </section>

          {/* Reset Data */}
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
              <span className="text-xl">⚠️</span> 위험 구역
            </h2>

            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <h3 className="font-bold text-red-800 mb-1">데이터 초기화 및 초기 예산 설정</h3>
              <p className="text-sm text-red-600 mb-4">
                모든 지출 내역과 예산이 삭제되고 초기 예산이 설정됩니다. 이 작업은 되돌릴 수
                없습니다.
              </p>
              <button
                onClick={() => {
                  setInitialBudget(1000000);
                  setIsResetModalOpen(true);
                }}
                className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
                disabled={isResetting}
                data-testid="reset-all-data-button"
              >
                🚨 모든 데이터 삭제 및 초기 예산 설정
              </button>
            </div>
          </section>
        </main>

        {/* Budget Edit Modal */}
        {isBudgetModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 rounded-xl">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">예산 변경</h3>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">월 예산 금액</label>
                <div className="relative">
                  <input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(Number(e.target.value))}
                    className="input-field pr-8 font-bold text-lg"
                    placeholder="0"
                    data-testid="monthly-budget-input"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    원
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="btn-secondary flex-1"
                  data-testid="cancel-budget-button"
                >
                  취소
                </button>
                <button
                  onClick={handleUpdateBudget}
                  className="btn-primary flex-1"
                  disabled={isUpdating}
                  data-testid="save-budget-button"
                >
                  {isUpdating ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Budget Adjustment Modal */}
        {isAdjustModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 rounded-xl">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 mb-4">이번달 예산 조정</h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">현재 남은 예산</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(currentBudget.data.balance)}원
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">목표 잔액</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetBalance}
                    onChange={(e) => setTargetBalance(Number(e.target.value))}
                    className="input-field pr-8 font-bold text-lg"
                    placeholder="0"
                    data-testid="target-balance-input"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    원
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">조정 내용</label>
                <textarea
                  value={adjustDescription}
                  onChange={(e) => setAdjustDescription(e.target.value)}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="예산 조정 사유를 입력하세요"
                  data-testid="adjust-description-input"
                />
              </div>

              {targetBalance !== currentBudget.data.balance && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 mb-1">조정 금액</p>
                  <p
                    className={`text-lg font-bold ${targetBalance > currentBudget.data.balance ? 'text-blue-600' : 'text-red-600'}`}
                  >
                    {targetBalance > currentBudget.data.balance ? '+' : ''}
                    {formatCurrency(targetBalance - currentBudget.data.balance)}원
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsAdjustModalOpen(false);
                    setAdjustDescription('');
                  }}
                  className="btn-secondary flex-1"
                  data-testid="cancel-adjust-button"
                >
                  취소
                </button>
                <button
                  onClick={handleAdjustBudget}
                  className="btn-primary flex-1"
                  disabled={isAdjusting}
                  data-testid="save-adjust-button"
                >
                  {isAdjusting ? '조정 중...' : '조정'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Modal */}
        {isResetModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                <span className="text-xl">⚠️</span> 데이터 초기화 및 초기 예산 설정
              </h3>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">경고:</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>모든 지출 내역이 삭제됩니다</li>
                  <li>모든 예산 기록이 삭제됩니다</li>
                  <li>모든 설정이 초기화됩니다</li>
                  <li>이 작업은 되돌릴 수 없습니다!</li>
                </ul>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  초기 예산 설정 (원)
                </label>
                <input
                  type="number"
                  value={initialBudget}
                  onChange={(e) => setInitialBudget(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="예: 1000000"
                  min="0"
                  step="10000"
                  data-testid="initial-budget-input"
                />
                <p className="text-xs text-gray-500 mt-1">초기화 후 설정될 기본 월별 예산입니다.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setInitialBudget(0);
                  }}
                  className="btn-secondary flex-1"
                  disabled={isResetting}
                  data-testid="cancel-reset-button"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        '⚠️ 마지막 확인\n\n정말로 모든 데이터를 삭제하고 초기화하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!'
                      )
                    ) {
                      handleReset();
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex-1"
                  disabled={isResetting}
                  data-testid="confirm-reset-button"
                >
                  {isResetting ? '초기화 중...' : '초기화 실행'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
