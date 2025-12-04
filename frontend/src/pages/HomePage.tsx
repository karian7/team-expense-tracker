import { useState } from 'react';
import BudgetSummary from '../components/budget/BudgetSummary';
import ReceiptUploader from '../components/receipt/ReceiptUploader';
import ExpenseForm from '../components/expense/ExpenseForm';
import ExpenseList from '../components/expense/ExpenseList';
import SettingsPage from './SettingsPage';
import MonthlyReportPage from './MonthlyReportPage';
import type { ReceiptUploadResponse } from '../types';

type Step = 'list' | 'upload' | 'form';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>('list');
  const [uploadResult, setUploadResult] = useState<ReceiptUploadResponse | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const handleUploadSuccess = (result: ReceiptUploadResponse) => {
    setUploadResult(result);
    setCurrentStep('form');
  };

  const handleFormSuccess = () => {
    setUploadResult(null);
    setCurrentStep('list');
  };

  const handleCancel = () => {
    setUploadResult(null);
    setCurrentStep('list');
  };

  const startUpload = () => {
    setCurrentStep('upload');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">팀 회식비 관리</h1>
          {currentStep === 'list' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(true)}
                className="text-gray-600 hover:text-gray-900 p-2"
                aria-label="월별 리포트"
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
                className="text-gray-600 hover:text-gray-900 p-2"
                aria-label="설정"
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
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Budget Summary */}
        <BudgetSummary />

        {/* Add Expense Button */}
        {currentStep === 'list' && (
          <button
            onClick={startUpload}
            className="btn-primary w-full py-4 text-lg shadow-lg"
          >
            + 영수증 추가하기
          </button>
        )}

        {/* Upload Step */}
        {currentStep === 'upload' && (
          <div className="card">
            <div className="mb-4">
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                뒤로
              </button>
            </div>

            <h2 className="text-xl font-semibold mb-4">영수증 업로드</h2>
            <ReceiptUploader onUploadSuccess={handleUploadSuccess} />
          </div>
        )}

        {/* Form Step */}
        {currentStep === 'form' && uploadResult && (
          <div className="card">
            <div className="mb-4">
              <button
                onClick={handleCancel}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                취소
              </button>
            </div>

            <h2 className="text-xl font-semibold mb-4">사용 내역 확인</h2>
            {uploadResult.ocrResult.error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                OCR 분석 중 오류가 발생했습니다. 직접 내용을 확인해 입력해 주세요.
                <div className="mt-1 text-xs text-red-600">
                  {uploadResult.ocrResult.error}
                </div>
              </div>
            )}
            <ExpenseForm
              imageUrl={uploadResult.imageUrl}
              ocrResult={uploadResult.ocrResult}
              onSuccess={handleFormSuccess}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Expense List */}
        {currentStep === 'list' && <ExpenseList />}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
        <p>팀 회식비 관리 서비스</p>
      </footer>

      {/* Settings Modal */}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}

      {/* Monthly Report Modal */}
      {showReport && <MonthlyReportPage onClose={() => setShowReport(false)} />}
    </div>
  );
}