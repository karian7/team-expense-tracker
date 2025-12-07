import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateExpense } from '../../hooks/useExpenses';
import { getCurrentDate } from '../../utils/format';
import { API_ORIGIN } from '../../services/api';
import type { OcrResult } from '../../types';
import type { CreateExpenseData } from '../../services/local/expenseService';

interface ExpenseFormProps {
  imageUrl: string;
  ocrResult: OcrResult;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ExpenseForm({
  imageUrl,
  ocrResult,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const [savedAuthorName] = useState<string>(() => localStorage.getItem('lastAuthorName') || '');
  const createMutation = useCreateExpense();

  // Local mutation states
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<Omit<CreateExpenseData, 'receiptImageUrl' | 'ocrRawData'>>({
    defaultValues: {
      authorName: savedAuthorName,
      amount: ocrResult.amount || 0,
      expenseDate: ocrResult.date || getCurrentDate(),
      storeName: ocrResult.storeName || '',
    },
  });

  useEffect(() => {
    if (savedAuthorName) setValue('authorName', savedAuthorName);
    if (ocrResult.amount) setValue('amount', ocrResult.amount);
    if (ocrResult.date) setValue('expenseDate', ocrResult.date);
    if (ocrResult.storeName) setValue('storeName', ocrResult.storeName);
  }, [ocrResult, savedAuthorName, setValue]);

  const onSubmit = async (data: Omit<CreateExpenseData, 'receiptImageUrl' | 'ocrRawData'>) => {
    try {
      setIsPending(true);
      setError(null);

      // 작성자 이름을 로컬 스토리지에 저장
      localStorage.setItem('lastAuthorName', data.authorName);

      await createMutation.mutateAsync({
        ...data,
        receiptImageUrl: imageUrl,
        ocrRawData: ocrResult,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError(err as Error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* OCR Confidence */}
      {ocrResult && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
          <span className="text-xl">🤖</span>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-bold text-blue-900">AI 영수증 분석 완료</h3>
              <span className="text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                신뢰도 {(ocrResult.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-blue-700">
              영수증 내용을 자동으로 입력했습니다. 정확하지 않은 정보가 있다면 수정해주세요.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Receipt Image Preview */}
        <div className="order-2 md:order-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">영수증 이미지</label>
          <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 h-64 md:h-auto md:aspect-[3/4]">
            <img
              src={`${API_ORIGIN}${imageUrl}`}
              alt="Receipt"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Form Fields */}
        <div className="order-1 md:order-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              작성자 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('authorName', { required: '작성자 이름을 입력해주세요' })}
              className={`input-field ${errors.authorName ? 'border-red-300 focus:ring-red-500' : ''}`}
              placeholder="이름을 입력하세요"
            />
            {errors.authorName && (
              <p className="mt-1 text-xs text-red-500">{errors.authorName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              금액 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                {...register('amount', {
                  required: '금액을 입력해주세요',
                  min: { value: 1, message: '금액은 1원 이상이어야 합니다' },
                })}
                className={`input-field pr-8 font-bold text-lg ${errors.amount ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                원
              </span>
            </div>
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상호명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('storeName', { required: '상호명을 입력해주세요' })}
              className={`input-field ${errors.storeName ? 'border-red-300 focus:ring-red-500' : ''}`}
              placeholder="식당/카페 이름"
            />
            {errors.storeName && (
              <p className="mt-1 text-xs text-red-500">{errors.storeName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사용 날짜 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('expenseDate', { required: '날짜를 선택해주세요' })}
              className={`input-field ${errors.expenseDate ? 'border-red-300 focus:ring-red-500' : ''}`}
            />
            {errors.expenseDate && (
              <p className="mt-1 text-xs text-red-500">{errors.expenseDate.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          저장 실패: {error.message || '알 수 없는 오류'}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1"
            disabled={isPending}
          >
            취소
          </button>
        )}
        <button type="submit" className="btn-primary flex-1" disabled={isPending}>
          {isPending ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </form>
  );
}
