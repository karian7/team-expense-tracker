import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import {
  useAppSettings,
  useUpdateDefaultMonthlyBudget,
  useResetAllData,
  useNeedsFullSync,
  useFullSync,
  useIgnoreFullSync,
  useResetLocalData,
} from '../hooks/useSettings';
import { useCurrentBudget, useAdjustCurrentBudget } from '../hooks/useBudget';
import { formatCurrency } from '../utils/format';
import { db } from '../services/db/database';
import { pushNotificationService } from '../services/pushNotificationService';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const settings = useAppSettings();
  const currentBudget = useCurrentBudget();
  const updateMutation = useUpdateDefaultMonthlyBudget();
  const resetMutation = useResetAllData();
  const adjustBudgetMutation = useAdjustCurrentBudget();
  const resetLocalDataMutation = useResetLocalData();

  // Full Sync
  const needsFullSyncQuery = useNeedsFullSync();
  const fullSyncMutation = useFullSync();
  const ignoreFullSyncMutation = useIgnoreFullSync();

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
  const [isSyncing, setIsSyncing] = useState(false);

  // Push notification states
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  // Check push notification support and subscription status
  useEffect(() => {
    const checkPushStatus = async () => {
      const supported = pushNotificationService.isSupported();
      setIsPushSupported(supported);

      if (supported) {
        const isSubscribed = await pushNotificationService.isSubscribed();
        setIsPushEnabled(isSubscribed);
      }
    };

    checkPushStatus();
  }, []);

  // 로컬 이벤트 통계 (Full Sync용)
  const localEventCount = useLiveQuery(() => db.budgetEvents.count(), []);
  const latestEvents = useLiveQuery(
    () => db.budgetEvents.orderBy('sequence').reverse().limit(10).toArray(),
    []
  );

  const handleUpdateBudget = async () => {
    try {
      setIsUpdating(true);
      await updateMutation.mutateAsync(newBudget);
      setIsBudgetModalOpen(false);
      toast.success('예산이 변경되었습니다.');
    } catch (error) {
      console.error('Budget update error:', error);
      toast.error('예산 변경에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAdjustBudget = async () => {
    if (!adjustDescription.trim()) {
      toast.error('조정 내용을 입력해주세요.');
      return;
    }

    if (targetBalance < 0) {
      toast.error('목표 잔액은 0원 이상이어야 합니다.');
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
      toast.success('이번달 예산이 조정되었습니다.');
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

      toast.error(errorMessage);
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleReset = async () => {
    if (initialBudget < 0) {
      toast.error('초기 예산은 0원 이상이어야 합니다.');
      return;
    }

    try {
      setIsResetting(true);
      await resetMutation.mutateAsync(initialBudget);
      setIsResetModalOpen(false);
      setInitialBudget(0);
      toast.success('모든 데이터가 초기화되었습니다.');
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('초기화에 실패했습니다.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleFullSync = async () => {
    if (!window.confirm('로컬 데이터를 서버에 동기화하시겠습니까?')) {
      return;
    }

    try {
      setIsSyncing(true);
      const result = await fullSyncMutation.mutateAsync();

      if (result.success) {
        toast.success(`동기화 완료! ${result.totalSynced}개 이벤트가 서버에 저장되었습니다.`);
      } else {
        toast.error(`동기화 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Full sync error:', error);
      toast.error('동기화에 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIgnoreFullSync = async () => {
    if (!window.confirm('Full Sync를 무시하시겠습니까? (서버에 데이터가 전송되지 않습니다)')) {
      return;
    }

    try {
      await ignoreFullSyncMutation.mutateAsync();
      toast.success('Full Sync가 무시되었습니다.');
    } catch (error) {
      console.error('Ignore full sync error:', error);
      toast.error('Full Sync 무시에 실패했습니다.');
    }
  };

  const handleResetLocalData = async () => {
    if (
      !window.confirm(
        '로컬 데이터베이스를 모두 삭제하고 서버 데이터로 다시 동기화할까요? 진행 중에는 앱을 닫지 마세요.'
      )
    ) {
      return;
    }

    try {
      await resetLocalDataMutation.mutateAsync();
      toast.success('로컬 데이터가 삭제되고 서버 데이터로 재동기화되었습니다.');
    } catch (error) {
      console.error('Reset local data error:', error);
      toast.error('로컬 데이터 초기화에 실패했습니다.');
    }
  };

  const handleTogglePushNotifications = async () => {
    if (!isPushSupported) {
      toast.error('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return;
    }

    setIsPushLoading(true);

    try {
      if (isPushEnabled) {
        // Unsubscribe
        await pushNotificationService.unsubscribe();
        setIsPushEnabled(false);
        toast.success('푸시 알림이 비활성화되었습니다.');
      } else {
        // Subscribe
        const permission = pushNotificationService.getPermission();

        if (permission === 'denied') {
          toast.error('푸시 알림 권한이 거부되었습니다.\n브라우저 설정에서 권한을 허용해주세요.', {
            duration: 4000,
          });
          return;
        }

        await pushNotificationService.subscribe();
        setIsPushEnabled(true);
        toast.success('푸시 알림이 활성화되었습니다!');
      }
    } catch (error) {
      console.error('Push notification toggle error:', error);
      toast.error('푸시 알림 설정에 실패했습니다.');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!isPushEnabled) {
      toast.error('먼저 푸시 알림을 활성화해주세요.');
      return;
    }

    try {
      await pushNotificationService.sendTestNotification();
      toast.success('테스트 알림이 전송되었습니다!');
    } catch (error) {
      console.error('Test notification error:', error);
      toast.error('테스트 알림 전송에 실패했습니다.');
    }
  };

  // useQuery returns { data, isLoading, error }
  if (settings.isLoading || currentBudget === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!settings.data || !currentBudget) {
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
                    {formatCurrency(currentBudget.balance)}원
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTargetBalance(currentBudget.balance);
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

          {/* Push Notifications */}
          <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-xl">🔔</span> 푸시 알림
            </h2>

            {!isPushSupported ? (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  현재 브라우저는 푸시 알림을 지원하지 않습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">푸시 알림</p>
                    <p className="text-sm text-gray-500">
                      {isPushEnabled
                        ? '새로운 지출 및 예산 알림을 받습니다'
                        : '알림을 활성화하여 업데이트를 받으세요'}
                    </p>
                  </div>
                  <button
                    onClick={handleTogglePushNotifications}
                    disabled={isPushLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isPushEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    } ${isPushLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    data-testid="push-notification-toggle"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPushEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {isPushEnabled && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-700 mb-3">
                      푸시 알림이 활성화되었습니다. 테스트 알림을 보내보세요!
                    </p>
                    <button
                      onClick={handleTestNotification}
                      className="btn-secondary text-sm py-1.5 px-3"
                      data-testid="test-notification-button"
                    >
                      테스트 알림 전송
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm bg-gray-50 p-3 rounded-lg text-gray-600">
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
                  PWA로 설치 후 사용하면 백그라운드에서도 알림을 받을 수 있습니다.
                </div>
              </div>
            )}
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

            <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <h3 className="font-bold text-yellow-800 mb-1">로컬 데이터만 초기화</h3>
              <p className="text-sm text-yellow-700 mb-4">
                IndexedDB를 비우고 서버에서 다시 내려받아 최신 상태로 복구합니다. 서버 데이터는
                변경되지 않습니다.
              </p>
              <button
                onClick={handleResetLocalData}
                className="w-full py-2 bg-white border border-yellow-200 text-yellow-700 rounded-lg hover:bg-yellow-100 font-medium transition-colors"
                disabled={resetLocalDataMutation.isPending}
                data-testid="reset-local-data-button"
              >
                {resetLocalDataMutation.isPending ? '초기화 중...' : '🧹 로컬 데이터만 삭제'}
              </button>
            </div>
          </section>

          {/* Full Sync Section */}
          {needsFullSyncQuery.data && (
            <section className="bg-white rounded-xl p-6 shadow-sm border border-orange-200">
              <h2 className="text-lg font-bold text-orange-600 mb-4 flex items-center gap-2">
                <span className="text-xl">🔄</span> 서버 동기화 필요
              </h2>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 mb-4">
                <h3 className="font-bold text-orange-800 mb-2">
                  리모트 데이터베이스가 리셋되었습니다
                </h3>
                <p className="text-sm text-orange-600 mb-4">
                  로컬에 저장된 데이터를 서버에 동기화하시겠습니까?
                </p>

                {/* 로컬 이벤트 통계 */}
                <div className="bg-white rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">로컬 이벤트 통계</p>
                  <p className="text-2xl font-bold text-orange-600">총 {localEventCount ?? 0}건</p>
                </div>

                {/* 최신 이벤트 10건 */}
                {latestEvents && latestEvents.length > 0 && (
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">최신 이벤트 10건</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {latestEvents.map((event) => (
                        <div
                          key={event.sequence}
                          className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">
                              {event.eventType === 'EXPENSE'
                                ? `💸 ${event.storeName || '지출'}`
                                : `💰 ${event.description || '예산'}`}
                            </p>
                            <p className="text-gray-500">
                              {new Date(event.eventDate).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="font-bold text-gray-900">
                            {formatCurrency(event.amount)}원
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-3">
                  <button
                    onClick={handleIgnoreFullSync}
                    className="flex-1 py-2 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 font-medium transition-colors"
                    disabled={isSyncing || ignoreFullSyncMutation.isPending}
                  >
                    무시
                  </button>
                  <button
                    onClick={handleFullSync}
                    className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                    disabled={isSyncing || fullSyncMutation.isPending}
                  >
                    {isSyncing ? '동기화 중...' : '🔄 동기화'}
                  </button>
                </div>
              </div>
            </section>
          )}
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
