import { useMemo, useState, useEffect } from 'react';
import { useExpenses, useDeleteExpense } from '../../hooks/useExpenses';
import { useCurrentBudget } from '../../hooks/useBudget';
import { syncService } from '../../services/sync/syncService';
import { formatCurrency, formatDateTimeKorean } from '../../utils/format';

import type { Expense, OcrResult } from '../../types';

const toBase64 = (bytes: ArrayLike<number>): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i];
    if (typeof value === 'number') {
      binary += String.fromCharCode(value & 0xff);
    }
  }
  return btoa(binary);
};

const toByteArrayFromRecord = (value: Record<string, unknown>): Uint8Array | null => {
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return null;
  }

  if (!keys.every((key) => /^\d+$/.test(key))) {
    return null;
  }

  const sorted = keys.map(Number).sort((a, b) => a - b);
  const lastIndex = sorted[sorted.length - 1];
  const buffer = new Uint8Array(lastIndex + 1);

  for (const index of sorted) {
    const raw = value[String(index)];
    if (typeof raw === 'number') {
      buffer[index] = raw & 0xff;
    } else if (typeof raw === 'string') {
      buffer[index] = Number.parseInt(raw, 10) & 0xff;
    }
  }

  return buffer;
};

const normalizeReceiptImage = (image: unknown): string | null => {
  if (!image) {
    return null;
  }

  if (typeof image === 'string') {
    const dataUrlPrefix = 'data:image';
    if (image.startsWith(dataUrlPrefix)) {
      const [, base64] = image.split(',');
      return base64 ?? null;
    }
    return image;
  }

  if (image instanceof ArrayBuffer) {
    return toBase64(new Uint8Array(image));
  }

  if (ArrayBuffer.isView(image)) {
    return toBase64(new Uint8Array(image.buffer, image.byteOffset, image.byteLength));
  }

  if (Array.isArray(image)) {
    return toBase64(Uint8Array.from(image));
  }

  if (typeof image === 'object') {
    const candidate = image as {
      data?: unknown;
      base64?: unknown;
      encoding?: string;
    };

    if (typeof candidate.base64 === 'string') {
      return candidate.base64;
    }

    if (candidate.data instanceof ArrayBuffer) {
      return toBase64(new Uint8Array(candidate.data));
    }

    if (candidate.data && ArrayBuffer.isView(candidate.data as ArrayBufferView)) {
      const view = candidate.data as ArrayBufferView;
      return toBase64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    }

    if (Array.isArray(candidate.data)) {
      return toBase64(Uint8Array.from(candidate.data));
    }

    if (typeof candidate.data === 'string') {
      if (candidate.encoding && candidate.encoding !== 'base64') {
        const textEncoder = new TextEncoder();
        return toBase64(textEncoder.encode(candidate.data));
      }
      return candidate.data;
    }

    const fromRecord = toByteArrayFromRecord(candidate);
    if (fromRecord) {
      return toBase64(fromRecord);
    }
  }

  return null;
};

interface ExpenseListProps {
  initialSelectedSequence?: number | null;
  onSequenceHandled?: () => void;
}

export default function ExpenseList({
  initialSelectedSequence,
  onSequenceHandled,
}: ExpenseListProps = {}) {
  const budget = useCurrentBudget();
  const expenses = useExpenses(budget ? { year: budget.year, month: budget.month } : undefined);
  const sortedExpenses = useMemo(() => {
    if (!expenses) {
      return [];
    }
    return [...expenses].sort((a, b) => {
      const dateDiff = new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return (b.sequence ?? 0) - (a.sequence ?? 0);
    });
  }, [expenses]);

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useDeleteExpense();
  const selectedReceiptImage = selectedExpense
    ? normalizeReceiptImage(selectedExpense.receiptImage as unknown)
    : null;

  // Deep Link 처리: initialSelectedSequence에 해당하는 expense 자동 오픈
  useEffect(() => {
    if (initialSelectedSequence && expenses) {
      const expense = expenses.find((e) => e.sequence === initialSelectedSequence);

      if (expense) {
        setSelectedExpense(expense);

        // 처리 완료 콜백
        if (onSequenceHandled) {
          onSequenceHandled();
        }
      }
    }
  }, [initialSelectedSequence, expenses, onSequenceHandled]);

  const handleRetrySync = async () => {
    try {
      setIsSyncing(true);
      await syncService.sync();
    } catch (error) {
      console.error('Retry sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const renderSyncBadge = (expense: Expense) => {
    if (expense.syncState === 'failed') {
      return (
        <span className="text-xs px-2 py-0.5 bg-red-50 text-red-600 rounded-full">동기화 실패</span>
      );
    }

    if (expense.syncState === 'pending') {
      return (
        <span className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full">
          동기화 중
        </span>
      );
    }

    return null;
  };

  const closeModal = () => {
    setSelectedExpense(null);
    setDeleteError(null);
  };

  const handleDeleteExpense = async () => {
    if (!selectedExpense) {
      return;
    }

    const confirmed = window.confirm('선택한 지출을 삭제할까요? 삭제된 내역은 되돌릴 수 없습니다.');
    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteMutation.mutateAsync({
        sequence: selectedExpense.sequence,
        description: selectedExpense.description ?? selectedExpense.storeName ?? undefined,
        authorName: selectedExpense.authorName,
      });
      closeModal();
    } catch (error) {
      console.error('Delete expense error:', error);
      const message = error instanceof Error ? error.message : '지출 삭제에 실패했습니다.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
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

  return (
    <div className="space-y-6">
      {/* List */}
      <div className="space-y-3">
        {sortedExpenses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <p className="text-lg font-medium text-gray-900">등록된 지출 내역이 없습니다.</p>
            <p className="mt-1 text-sm text-gray-500">새로운 지출을 추가해보세요.</p>
          </div>
        ) : (
          sortedExpenses.map((expense: Expense) => (
            <div
              key={expense.sequence}
              className="group bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer"
              onClick={() => {
                setDeleteError(null);
                setSelectedExpense(expense);
              }}
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
                      {expense.authorName} · {formatDateTimeKorean(expense.eventDate)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 flex items-center justify-end gap-2">
                    <span>{formatCurrency(expense.amount)}원</span>
                    {renderSyncBadge(expense)}
                  </div>
                  {expense.syncState === 'failed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetrySync();
                      }}
                      className="text-xs text-red-600 hover:text-red-700 mt-2"
                      disabled={isSyncing}
                    >
                      재시도
                    </button>
                  )}
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
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-48 bg-gray-100 flex items-center justify-center">
              {selectedReceiptImage ? (
                <img
                  src={`data:image/jpeg;base64,${selectedReceiptImage}`}
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
                onClick={closeModal}
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
                    {formatDateTimeKorean(selectedExpense.eventDate)}
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

              {deleteError && (
                <p className="mt-6 text-sm text-red-600" role="alert">
                  {deleteError}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button onClick={closeModal} className="btn-secondary flex-1">
                  닫기
                </button>
                <button
                  onClick={handleDeleteExpense}
                  className="btn-danger flex-1"
                  disabled={isDeleting}
                >
                  {isDeleting ? '삭제 중...' : '지출 삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
