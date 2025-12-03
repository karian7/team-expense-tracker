import { useState } from 'react';
import BudgetSummary from '../components/budget/BudgetSummary';
import ReceiptUploader from '../components/receipt/ReceiptUploader';
import ExpenseForm from '../components/expense/ExpenseForm';
import ExpenseList from '../components/expense/ExpenseList';
import type { ReceiptUploadResponse } from '../types';

type Step = 'upload' | 'form' | 'list';

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<Step>('list');
  const [uploadResult, setUploadResult] = useState<ReceiptUploadResponse | null>(null);

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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">팀 회식비 관리</h1>
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
    </div>
  );
}
