import { useState, useRef, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import BudgetSummary from '../components/budget/BudgetSummary';
import ExpenseForm from '../components/expense/ExpenseForm';
import ExpenseList from '../components/expense/ExpenseList';
import SettingsPage from './SettingsPage';
import MonthlyReportPage from './MonthlyReportPage';
import HelpPage from './HelpPage';
import type { ReceiptUploadResponse } from '../types';
import { useUploadReceipt } from '../hooks/useReceipt';
import { eventService } from '../services/local/eventService';

type Step = 'list' | 'upload' | 'form' | 'processing';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>('list');
  const [uploadResult, setUploadResult] = useState<ReceiptUploadResponse | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deepLinkSequence, setDeepLinkSequence] = useState<number | null>(null);

  // Hooks and Refs
  const uploadMutation = useUploadReceipt();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
    setUploadResult(result);
    // If we have a local preview, use it? Or use the one from server?
    // The result from server usually has the image buffer or ID.
    // For now we trust the result.
    setCurrentStep('form');
  };

  const handleFormSuccess = () => {
    setUploadResult(null);
    setPreviewImage(null);
    setCurrentStep('list');
  };

  const handleCancel = () => {
    setUploadResult(null);
    setPreviewImage(null);
    setCurrentStep('list');
  };

  const handleUploadError = (error: Error) => {
    console.error('Upload error:', error);
    alert('영수증 업로드 중 오류가 발생했습니다. 다시 시도해 주세요.');
    setPreviewImage(null);
    setCurrentStep('list');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow selecting same file again if needed
    e.target.value = '';

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
      setCurrentStep('processing');
    };
    reader.readAsDataURL(file);

    // Proceed with upload
    try {
      const result = await uploadMutation.mutateAsync(file);
      handleUploadSuccess(result);
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
