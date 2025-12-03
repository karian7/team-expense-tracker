import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useCreateExpense } from '../../hooks/useExpenses';
import { getCurrentDate } from '../../utils/format';
import type { ExpenseFormData, OcrResult } from '../../types';

interface ExpenseFormProps {
  imageUrl: string;
  ocrResult: OcrResult;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ExpenseForm({ imageUrl, ocrResult, onSuccess, onCancel }: ExpenseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useCreateExpense();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ExpenseFormData>({
    defaultValues: {
      authorName: '',
      amount: ocrResult.amount || 0,
      expenseDate: ocrResult.date || getCurrentDate(),
      storeName: ocrResult.storeName || '',
      receiptImageUrl: imageUrl,
    },
  });

  useEffect(() => {
    if (ocrResult.amount) setValue('amount', ocrResult.amount);
    if (ocrResult.date) setValue('expenseDate', ocrResult.date);
    if (ocrResult.storeName) setValue('storeName', ocrResult.storeName);
  }, [ocrResult, setValue]);

  const onSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true);

    try {
      await createMutation.mutateAsync({
        ...data,
        receiptImageUrl: imageUrl,
        ocrRawData: ocrResult,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confidenceColor =
    ocrResult.confidence > 0.7
      ? 'text-green-600'
      : ocrResult.confidence > 0.4
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* OCR 신뢰도 표시 */}
      {ocrResult.confidence > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              AI 분석 완료
            </span>
            <span className={`text-sm font-semibold ${confidenceColor}`}>
              신뢰도: {(ocrResult.confidence * 100).toFixed(0)}%
            </span>
          </div>
          {ocrResult.confidence < 0.7 && (
            <p className="text-xs text-blue-700 mt-1">
              인식된 정보를 확인하고 필요시 수정해주세요.
            </p>
          )}
        </div>
      )}

      {/* 영수증 미리보기 */}
      <div className="relative">
        <img
          src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${imageUrl}`}
          alt="Receipt"
          className="w-full h-48 object-cover rounded-lg"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 작성자 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            작성자 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('authorName', { required: '작성자 이름을 입력해주세요' })}
            className="input-field"
            placeholder="홍길동"
          />
          {errors.authorName && (
            <p className="text-sm text-red-600 mt-1">{errors.authorName.message}</p>
          )}
        </div>

        {/* 사용 금액 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            사용 금액 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              {...register('amount', {
                required: '금액을 입력해주세요',
                min: { value: 1, message: '금액은 1원 이상이어야 합니다' },
              })}
              className="input-field pr-12"
              placeholder="50000"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              원
            </span>
          </div>
          {errors.amount && (
            <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
          )}
        </div>

        {/* 사용 날짜 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            사용 날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register('expenseDate', { required: '날짜를 선택해주세요' })}
            className="input-field"
          />
          {errors.expenseDate && (
            <p className="text-sm text-red-600 mt-1">{errors.expenseDate.message}</p>
          )}
        </div>

        {/* 상호명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            상호명 (선택)
          </label>
          <input
            type="text"
            {...register('storeName')}
            className="input-field"
            placeholder="식당 이름"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>

      {createMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            저장 실패: {createMutation.error?.message || '알 수 없는 오류'}
          </p>
        </div>
      )}
    </div>
  );
}
