import { useState } from 'react';
import { useExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import { useCurrentBudget } from '../../hooks/useBudget';
import { formatCurrency, formatDateTimeKorean } from '../../utils/format';
import { API_ORIGIN } from '../../services/api';
import type { Expense } from '../../services/db/database';
import type { OcrResult } from '../../types';

export default function ExpenseList() {
  const budget = useCurrentBudget();
  const expenses = useExpenses(budget ? { year: budget.year, month: budget.month } : undefined);
  const deleteMutation = useDeleteExpense();

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filterAuthor, setFilterAuthor] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    if (window.confirm('이 사용 내역을 삭제하시겠습니까?')) {
      try {
        setIsDeleting(true);
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Delete error:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // useLiveQuery returns undefined while loading
  if (!budget || !expenses) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse border border-white/10">
            <div className="h-4 bg-white/10 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-white/10 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const filteredExpenses = expenses.filter((expense) =>
    filterAuthor ? expense.authorName.includes(filterAuthor) : true
  );

  const uniqueAuthors = Array.from(new Set(expenses.map((e) => e.authorName)));

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex justify-end">
        <select
          value={filterAuthor}
          onChange={(e) => setFilterAuthor(e.target.value)}
          className="input-field w-auto min-w-[120px] py-1.5 text-sm"
        >
          <option value="">모든 사용자</option>
          {uniqueAuthors.map((author) => (
            <option key={author} value={author}>
              {author}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <p className="text-lg font-medium text-gray-900">필터링된 사용 내역이 없습니다.</p>
            <p className="mt-1 text-sm text-gray-500">다른 필터를 선택해보세요.</p>
          </div>
        ) : (
          filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className="group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer"
              onClick={() => setSelectedExpense(expense)}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-semibold text-sm">
                    {expense.authorName.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {expense.storeName || '상호명 없음'}
                    </h3>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {expense.authorName} · {formatDateTimeKorean(expense.expenseDate)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{formatCurrency(expense.amount)}원</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(expense.id);
                    }}
                    className="text-xs text-red-500 hover:text-red-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isDeleting}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedExpense && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedExpense(null)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 bg-gray-100 flex items-center justify-center">
              {selectedExpense.receiptImage || selectedExpense.receiptImageUrl ? (
                <img
                  src={
                    selectedExpense.receiptImage
                      ? `data:image/jpeg;base64,${selectedExpense.receiptImage}`
                      : `${API_ORIGIN}${selectedExpense.receiptImageUrl}`
                  }
                  alt="Receipt"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="10" y="10" width="100" height="100" rx="8" stroke="#9CA3AF" stroke-width="2" stroke-dasharray="8 4" fill="#F3F4F6"/>
                          <circle cx="60" cy="45" r="15" fill="#D1D5DB"/>
                          <path d="M30 85 L45 65 L60 75 L75 55 L90 70 L90 95 L30 95 Z" fill="#E5E7EB"/>
                          <text x="60" y="108" text-anchor="middle" fill="#6B7280" font-size="12" font-family="system-ui, -apple-system, sans-serif">영수증 없음</text>
                        </svg>
                      `;
                    }
                  }}
                />
              ) : (
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="10"
                    y="10"
                    width="100"
                    height="100"
                    rx="8"
                    stroke="#9CA3AF"
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    fill="#F3F4F6"
                  />
                  <circle cx="60" cy="45" r="15" fill="#D1D5DB" />
                  <path d="M30 85 L45 65 L60 75 L75 55 L90 70 L90 95 L30 95 Z" fill="#E5E7EB" />
                  <text
                    x="60"
                    y="108"
                    textAnchor="middle"
                    fill="#6B7280"
                    fontSize="12"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    영수증 없음
                  </text>
                </svg>
              )}
              <button
                onClick={() => setSelectedExpense(null)}
                className="absolute top-4 right-4 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
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

            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedExpense.storeName || '상호명 없음'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDateTimeKorean(selectedExpense.expenseDate)}
                  </p>
                </div>
                <div className="text-xl font-bold text-primary-600">
                  {formatCurrency(selectedExpense.amount)}원
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500">작성자</span>
                  <span className="font-medium text-gray-900">{selectedExpense.authorName}</span>
                </div>

                {selectedExpense.ocrRawData && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium mb-1">AI 분석 정보</p>
                    <p className="text-xs text-blue-800">
                      신뢰도:{' '}
                      {(() => {
                        try {
                          const parsed =
                            typeof selectedExpense.ocrRawData === 'string'
                              ? (JSON.parse(selectedExpense.ocrRawData) as OcrResult)
                              : (selectedExpense.ocrRawData as OcrResult);
                          return `${(parsed.confidence * 100).toFixed(0)}%`;
                        } catch {
                          return 'N/A';
                        }
                      })()}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    handleDelete(selectedExpense.id);
                    setSelectedExpense(null);
                  }}
                  className="btn-danger flex-1"
                  disabled={isDeleting}
                >
                  삭제하기
                </button>
                <button onClick={() => setSelectedExpense(null)} className="btn-secondary flex-1">
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
