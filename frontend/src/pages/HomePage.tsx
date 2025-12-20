import { useState, useRef, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import BudgetSummary from '../components/budget/BudgetSummary';
import ExpenseForm from '../components/expense/ExpenseForm';
import ExpenseList from '../components/expense/ExpenseList';
import SettingsPage from './SettingsPage';
import MonthlyReportPage from './MonthlyReportPage';
import HelpPage from './HelpPage';
import SyncStatusIndicator from '../components/sync/SyncStatusIndicator';
import type { ReceiptUploadResponse } from '../types';
import { useUploadReceipt } from '../hooks/useReceipt';
import { eventService } from '../services/local/eventService';
import { receiptStorageService } from '../services/local/receiptStorageService';

type Step = 'list' | 'upload' | 'form' | 'processing' | 'error';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>('list');
  const [uploadResult, setUploadResult] = useState<ReceiptUploadResponse | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deepLinkSequence, setDeepLinkSequence] = useState<number | null>(null);
  const [hasStoredReceipt, setHasStoredReceipt] = useState(false);

  // Hooks and Refs
  const uploadMutation = useUploadReceipt();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // 저장된 영수증 확인 (화면 진입 시)
  useEffect(() => {
    const checkStoredReceipt = async () => {
      const hasReceipt = await receiptStorageService.hasLastReceipt();
      setHasStoredReceipt(hasReceipt);
      if (hasReceipt) {
        console.log('[HomePage] 저장된 영수증이 발견되었습니다.');
      }
    };

    // list 화면일 때만 확인
    if (currentStep === 'list') {
      checkStoredReceipt();
    }
  }, [currentStep]);

  // Deep Link 처리: Push 알림에서 /#expense/123 형식으로 접근 시 자동 오픈
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;

      // /#expense/123 형식 파싱
      const match = hash.match(/^#expense\/(\d+)$/);
      if (match) {
        const sequence = parseInt(match[1], 10);

        try {
          // IndexedDB에서 expense 조회
          const expense = await eventService.getEventBySequence(sequence);

          if (expense && expense.eventType === 'EXPENSE') {
            setDeepLinkSequence(sequence);
          } else {
            toast.error('해당 지출 내역을 찾을 수 없습니다.');
          }
        } catch (error) {
          console.error('Expense lookup failed:', error);
          toast.error('지출 내역을 불러오는 중 오류가 발생했습니다.');
        }

        // Hash 제거 (히스토리 오염 방지)
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    // 초기 로딩 시 + Hash 변경 시 실행
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const handleUploadSuccess = (result: ReceiptUploadResponse) => {
    // 영수증이 아닌 이미지를 업로드한 경우
    if (result.ocrResult.isReceipt === false) {
      toast.error(
        '업로드한 이미지가 영수증이 아닌 것 같습니다.\n영수증 사진을 다시 업로드해주세요.',
        {
          duration: 4000,
          icon: '⚠️',
        }
      );
      setPreviewImage(null);
      setCurrentStep('list');
      return;
    }

    setUploadResult(result);
    // If we have a local preview, use it? Or use the one from server?
    // The result from server usually has the image buffer or ID.
    // For now we trust the result.
    setCurrentStep('form');
  };

  const handleFormSuccess = () => {
    setUploadResult(null);
    setPreviewImage(null);
    setUploadError(null);
    setCurrentStep('list');
  };

  const handleCancel = () => {
    setUploadResult(null);
    setPreviewImage(null);
    setUploadError(null);
    setCurrentStep('list');
  };

  const handleUploadError = (error: Error) => {
    console.error('[HomePage] Upload error:', error);
    setUploadError(error);
    setCurrentStep('error');
    toast.error('영수증 업로드 중 오류가 발생했습니다.', {
      duration: 3000,
    });
  };

  const handleRetryUpload = async () => {
    try {
      const lastReceipt = await receiptStorageService.getLastReceipt();
      if (!lastReceipt) {
        console.warn('[HomePage] 재시도할 영수증 이미지가 없습니다');
        toast.error('재시도할 이미지가 없습니다.');
        setCurrentStep('list');
        return;
      }

      setPreviewImage(lastReceipt.imageData);
      setUploadError(null);
      setCurrentStep('processing');

      // base64를 Blob으로 변환
      const response = await fetch(lastReceipt.imageData);
      const blob = await response.blob();

      // MIME 타입 검증
      const mimeType = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const file = new File([blob], lastReceipt.fileName, { type: mimeType });

      console.log('[HomePage] 영수증 재시도:', {
        fileName: lastReceipt.fileName,
        size: blob.size,
        type: mimeType,
      });

      const result = await uploadMutation.mutateAsync(file);
      handleUploadSuccess(result);

      // 성공 시 로컬 이미지 삭제
      await receiptStorageService.clearLastReceipt();
      setHasStoredReceipt(false);
    } catch (error) {
      console.error('[HomePage] 재시도 실패:', error);
      handleUploadError(error as Error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow selecting same file again if needed
    e.target.value = '';

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageData = reader.result as string;
      setPreviewImage(imageData);
      setCurrentStep('processing');

      // 로컬에 이미지 저장 (재시도용)
      try {
        await receiptStorageService.saveLastReceipt(imageData, file.name);
        console.log('[HomePage] 영수증 이미지 로컬 저장 완료:', file.name);
      } catch (error) {
        console.error('[HomePage] 영수증 이미지 로컬 저장 실패:', error);
        // 저장 실패해도 업로드는 계속 진행
      }
    };
    reader.readAsDataURL(file);

    // Proceed with upload
    try {
      const result = await uploadMutation.mutateAsync(file);
      handleUploadSuccess(result);

      // 성공 시 로컬 이미지 삭제
      await receiptStorageService.clearLastReceipt();
      setHasStoredReceipt(false);
    } catch (error) {
      handleUploadError(error as Error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">💸</span>
            Team Expense Tracker
          </h1>
          <div className="flex gap-2">
            <SyncStatusIndicator />
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="도움말"
              data-testid="help-button"
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
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="월별 리포트"
              data-testid="monthly-report-button"
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="설정"
              data-testid="settings-button"
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Budget Summary */}
        <section>
          <BudgetSummary />
        </section>

        {/* Main Content Area */}
        <section>
          {currentStep === 'list' && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-col gap-3">
                  {/* Stored Receipt Retry Banner */}
                  {hasStoredReceipt && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-yellow-800 font-medium text-sm mb-1">
                            이전에 업로드 실패한 영수증이 있습니다
                          </p>
                          <p className="text-yellow-700 text-xs mb-2">
                            저장된 영수증을 다시 업로드하시겠습니까?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                await receiptStorageService.clearLastReceipt();
                                setHasStoredReceipt(false);
                                toast.success('저장된 영수증을 삭제했습니다.');
                              }}
                              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-yellow-700 border border-yellow-300 rounded-md text-xs font-medium transition-colors"
                            >
                              무시
                            </button>
                            <button
                              onClick={handleRetryUpload}
                              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              다시 시도
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Camera Button (Primary) */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-6 flex flex-col items-center justify-center gap-2 transition-colors shadow-md active:scale-95 transform duration-100"
                    data-testid="camera-button"
                  >
                    <div className="p-3 bg-white/20 rounded-full">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <span className="font-bold text-lg">영수증 촬영</span>
                  </button>

                  {/* Hidden Inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {/* Gallery Button (Secondary - Subtle) */}
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full py-2 text-gray-400 hover:text-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                    data-testid="gallery-button"
                  >
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
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    앨범에서 선택
                  </button>
                </div>
              </div>

              {/* Recent List */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 px-1">최근 사용 내역</h2>
                <ExpenseList
                  initialSelectedSequence={deepLinkSequence}
                  onSequenceHandled={() => setDeepLinkSequence(null)}
                />
              </div>
            </div>
          )}

          {(currentStep === 'processing' || currentStep === 'upload') && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">영수증 분석 중...</h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="cancel-upload-button"
                  disabled={uploadMutation.isPending}
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

              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[3/4] sm:aspect-video w-full">
                {previewImage && (
                  <img
                    src={previewImage}
                    alt="Receipt preview"
                    className="w-full h-full object-contain"
                  />
                )}

                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mb-4"></div>
                  <p className="text-primary-700 font-bold text-lg animate-pulse">
                    AI가 영수증을 분석하고 있습니다
                  </p>
                  <p className="text-gray-500 text-sm mt-2">잠시만 기다려주세요...</p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'error' && previewImage && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-red-600">업로드 실패</h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="close-error-button"
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

              <div className="relative rounded-xl overflow-hidden border border-red-200 bg-gray-50 aspect-[3/4] sm:aspect-video w-full mb-4">
                <img
                  src={previewImage}
                  alt="Receipt preview"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Error Message */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-red-800 font-medium mb-1">영수증 업로드에 실패했습니다</p>
                    <p className="text-red-600 text-sm">
                      {uploadError?.message ||
                        '네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleRetryUpload}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      재시도 중...
                    </>
                  ) : (
                    <>
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      다시 시도
                    </>
                  )}
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5"
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
                  <p className="text-blue-700 text-sm">
                    영수증 이미지가 로컬에 저장되어 있어 네트워크가 복구되면 언제든 다시 시도할 수
                    있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'form' && uploadResult && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">지출 정보 입력</h2>
              </div>
              <ExpenseForm
                imageBuffer={uploadResult.imageBuffer}
                ocrResult={uploadResult.ocrResult}
                onSuccess={handleFormSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-400">
        <p>팀 회식비 © 2026</p>
      </footer>

      {/* Modals */}
      {showReport && <MonthlyReportPage onClose={() => setShowReport(false)} />}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
    </div>
  );
}
