import { useState } from 'react';
import { useSettings, useUpdateSettings, useSetInitialBudget } from '../hooks/useSettings';
import { useExportExpenses, useDownloadTemplate, useImportExpenses } from '../hooks/useExport';
import { useCurrentBudget, useAdjustCurrentBudget } from '../hooks/useBudget';
import { formatCurrency } from '../utils/format';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const settings = useSettings();
  const currentBudget = useCurrentBudget();
  const updateMutation = useUpdateSettings();
  const setInitialBudgetMutation = useSetInitialBudget();
  const adjustBudgetMutation = useAdjustCurrentBudget();
  const exportMutation = useExportExpenses();
  const templateMutation = useDownloadTemplate();
  const importMutation = useImportExpenses();

  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [newBudget, setNewBudget] = useState(0);
  const [targetBalance, setTargetBalance] = useState(0);
  const [adjustDescription, setAdjustDescription] = useState('');

  // Local mutation states
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting] = useState(false);
  const [isDownloadingTemplate] = useState(false);
  // const [isImporting, setIsImporting] = useState(false);

  const handleUpdateBudget = async () => {
    try {
      setIsUpdating(true);
      await updateMutation.mutateAsync({
        defaultMonthlyBudget: newBudget,
      });
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
      alert('예산 조정에 실패했습니다.');
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleReset = async () => {
    const confirmMessage = '⚠️ 경고: 모든 데이터가 삭제됩니다!\n\n정말로 초기화하시겠습니까?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (
      !window.confirm(
        '정말로 모든 데이터를 삭제하고 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다!'
      )
    ) {
      return;
    }

    try {
      setIsResetting(true);
      await setInitialBudgetMutation.mutateAsync(0);
      alert('모든 데이터가 초기화되었습니다.');
    } catch (error) {
      console.error('Reset error:', error);
      alert('초기화에 실패했습니다.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handleDownloadTemplate = () => {
    templateMutation.mutate();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      // setIsImporting(true);
      const result = await importMutation.mutateAsync(file);

      let message = '복원 완료\n';
      message += `생성: ${result.created}건\n`;
      message += `업데이트: ${result.updated}건\n`;
      message += `실패: ${result.failed}건`;

      if (result.failed > 0) {
        message += `\n\n실패 내역:\n${result.errors.slice(0, 5).join('\n')}`;
        if (result.errors.length > 5) {
          message += `\n... 외 ${result.errors.length - 5}건`;
        }
      }

      alert(message);
      e.target.value = '';
    } catch (error) {
      console.error('Import error:', error);
      alert('복원에 실패했습니다.');
    }
    // finally {
    //   setIsImporting(false);
    // }
  };

  // useLiveQuery returns undefined while loading
  if (!settings || !currentBudget) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
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
                    {formatCurrency(settings.defaultMonthlyBudget)}원
                  </p>
                </div>
                <button
                  onClick={() => {
                    setNewBudget(settings.defaultMonthlyBudget);
                    setIsBudgetModalOpen(true);
                  }}
                  className="btn-secondary text-sm py-1.5 px-3"
                >
                  변경
                </button>
              </div>

              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div>
                  <p className="text-sm text-blue-600 font-medium">이번달 남은 예산</p>
                  <p className="text-xl font-bold text-blue-900">
                    {formatCurrency(currentBudget.balance)}원
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTargetBalance(currentBudget.balance);
                    setIsAdjustModalOpen(true);
                  }}
                  className="btn-primary text-sm py-1.5 px-3"
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

          {/* Data Management */}
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">💾</span> 데이터 관리
            </h2>

            <div className="space-y-3">
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
                disabled={isExporting}
              >
                <div>
                  <p className="font-medium text-gray-900">데이터 내보내기</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    모든 지출 내역을 CSV로 다운로드합니다.
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 group-hover:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>

              <button
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
                disabled={isDownloadingTemplate}
              >
                <div>
                  <p className="font-medium text-gray-900">CSV 템플릿 다운로드</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    데이터 가져오기를 위한 양식을 받습니다.
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 group-hover:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  className="hidden"
                  id="import-csv"
                />
                <label
                  htmlFor="import-csv"
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left cursor-pointer group"
                >
                  <div>
                    <p className="font-medium text-gray-900">데이터 가져오기</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      CSV 파일로 지출 내역을 일괄 등록합니다.
                    </p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-400 group-hover:text-gray-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </label>
              </div>
            </div>
          </section>

          {/* Reset Data */}
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
              <span className="text-xl">⚠️</span> 위험 구역
            </h2>

            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <h3 className="font-bold text-red-800 mb-1">데이터 초기화</h3>
              <p className="text-sm text-red-600 mb-4">
                모든 지출 내역과 설정이 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </p>
              <button
                onClick={handleReset}
                className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors"
                disabled={isResetting}
              >
                {isResetting ? '초기화 중...' : '초기화하기'}
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
                >
                  취소
                </button>
                <button
                  onClick={handleUpdateBudget}
                  className="btn-primary flex-1"
                  disabled={isUpdating}
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
                  {formatCurrency(currentBudget.balance)}원
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
                />
              </div>

              {targetBalance !== currentBudget.balance && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs text-blue-600 mb-1">조정 금액</p>
                  <p
                    className={`text-lg font-bold ${targetBalance > currentBudget.balance ? 'text-blue-600' : 'text-red-600'}`}
                  >
                    {targetBalance > currentBudget.balance ? '+' : ''}
                    {formatCurrency(targetBalance - currentBudget.balance)}원
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
                >
                  취소
                </button>
                <button
                  onClick={handleAdjustBudget}
                  className="btn-primary flex-1"
                  disabled={isAdjusting}
                >
                  {isAdjusting ? '조정 중...' : '조정'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
