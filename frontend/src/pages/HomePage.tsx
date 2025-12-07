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

  // Placeholder for handleUploadError, as it's used in the new JSX but not defined in original
  const handleUploadError = (error: Error) => {
    console.error('Upload error:', error);
    // Optionally, display an error message to the user
    setCurrentStep('list'); // Go back to list on error
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">💸</span>
            Team Expense Tracker
          </h1>
          <div className="flex gap-2">
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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">최근 사용 내역</h2>
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="btn-primary flex items-center gap-2 shadow-sm"
                  data-testid="add-expense-button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  지출 등록
                </button>
              </div>
              <ExpenseList />
            </div>
          )}

          {currentStep === 'upload' && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">영수증 업로드</h2>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600"
                  data-testid="cancel-upload-button"
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
              <ReceiptUploader
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
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
        <p>Team Expense Tracker Service © 2024</p>
      </footer>

      {/* Modals */}
      {showReport && <MonthlyReportPage onClose={() => setShowReport(false)} />}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
    </div>
  );
}
