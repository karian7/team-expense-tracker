import { useState } from 'react';
import { useExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import { useCurrentBudget } from '../../hooks/useBudget';
import { formatCurrency, formatDateKorean } from '../../utils/format';
import type { Expense } from '../../types';

export default function ExpenseList() {
  const { data: budget } = useCurrentBudget();
  const { data: expenses, isLoading, error } = useExpenses(
    budget ? { year: budget.year, month: budget.month } : undefined
  );
  const deleteMutation = useDeleteExpense();

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filterAuthor, setFilterAuthor] = useState('');

  const handleDelete = async (id: string) => {
    if (window.confirm('이 사용 내역을 삭제하시겠습니까?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border border-red-200">
        <p className="text-red-600">사용 내역을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const filteredExpenses = expenses?.filter((expense) =>
    filterAuthor ? expense.authorName.includes(filterAuthor) : true
  );

  const uniqueAuthors = Array.from(new Set(expenses?.map((e) => e.authorName) || []));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          사용 내역 ({filteredExpenses?.length || 0})
        </h3>

        {/* 작성자 필터 */}
        {uniqueAuthors.length > 1 && (
          <select
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">전체</option>
            {uniqueAuthors.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
        )}
      </div>

      {!filteredExpenses || filteredExpenses.length === 0 ? (
        <div className="card text-center py-8">
          <div className="text-gray-400 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">아직 사용 내역이 없습니다</p>
          <p className="text-sm text-gray-500 mt-1">영수증을 업로드해주세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedExpense(expense)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-600">
                      {expense.authorName}
                    </span>
                    {expense.storeName && (
                      <>
                        <span className="text-gray-400">·</span>
                        <span className="text-sm text-gray-500">{expense.storeName}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(expense.amount)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDateKorean(expense.expenseDate)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(expense.id);
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1"
                  disabled={deleteMutation.isPending}
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세보기 모달 */}
      {selectedExpense && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedExpense(null)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">사용 내역 상세</h3>
                <button
                  onClick={() => setSelectedExpense(null)}
                  className="text-gray-400 hover:text-gray-600"
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

              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${
                  selectedExpense.receiptImageUrl
                }`}
                alt="Receipt"
                className="w-full rounded-lg mb-4"
              />

              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">작성자</span>
                  <p className="font-semibold">{selectedExpense.authorName}</p>
                </div>

                <div>
                  <span className="text-sm text-gray-600">금액</span>
                  <p className="font-semibold text-xl">{formatCurrency(selectedExpense.amount)}</p>
                </div>

                <div>
                  <span className="text-sm text-gray-600">날짜</span>
                  <p className="font-semibold">{formatDateKorean(selectedExpense.expenseDate)}</p>
                </div>

                {selectedExpense.storeName && (
                  <div>
                    <span className="text-sm text-gray-600">상호명</span>
                    <p className="font-semibold">{selectedExpense.storeName}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedExpense(null)}
                className="btn-primary w-full mt-6"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
