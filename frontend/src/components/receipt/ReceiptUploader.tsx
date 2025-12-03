import { useState, useRef } from 'react';
import { useUploadReceipt } from '../../hooks/useReceipt';
import type { ReceiptUploadResponse } from '../../types';

interface ReceiptUploaderProps {
  onUploadSuccess: (result: ReceiptUploadResponse) => void;
  onUploadError?: (error: Error) => void;
}

export default function ReceiptUploader({ onUploadSuccess, onUploadError }: ReceiptUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadReceipt();

  const handleFileSelect = async (file: File) => {
    // 파일 미리보기
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // 파일 업로드 및 OCR
    try {
      const result = await uploadMutation.mutateAsync(file);
      onUploadSuccess(result);
    } catch (error) {
      console.error('Upload error:', error);
      if (onUploadError) {
        onUploadError(error as Error);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleClearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {!preview ? (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
            id="receipt-upload"
          />

          <label
            htmlFor="receipt-upload"
            className="cursor-pointer block"
          >
            <div className="mx-auto w-16 h-16 mb-4 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
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

            <div className="text-gray-600 mb-2">
              <span className="font-semibold text-primary-600">영수증 촬영</span> 또는{' '}
              <span className="font-semibold text-primary-600">파일 선택</span>
            </div>

            <p className="text-sm text-gray-500">
              사진을 찍거나 갤러리에서 선택하세요
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG, GIF, WebP (최대 10MB)
            </p>
          </label>
        </div>
      ) : (
        <div className="relative">
          <img
            src={preview}
            alt="Receipt preview"
            className="w-full h-auto rounded-lg shadow-md"
          />

          {uploadMutation.isPending && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3"></div>
                <p className="font-medium">영수증 분석 중...</p>
              </div>
            </div>
          )}

          {!uploadMutation.isPending && (
            <button
              onClick={handleClearPreview}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-colors shadow-lg"
              type="button"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {uploadMutation.isError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            업로드 실패: {uploadMutation.error?.message || '알 수 없는 오류'}
          </p>
        </div>
      )}
    </div>
  );
}
