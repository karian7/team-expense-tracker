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
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-gray-900 font-medium mb-1">
            영수증 이미지를 드래그하거나 클릭하여 업로드하세요
          </p>
          <p className="text-sm text-gray-500">JPG, PNG 파일 지원</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          <img src={preview} alt="Receipt preview" className="w-full h-64 object-contain" />

          {uploadMutation.isPending && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-3"></div>
              <p className="text-primary-600 font-medium">AI가 영수증을 분석하고 있습니다...</p>
            </div>
          )}

          {!uploadMutation.isPending && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearPreview();
              }}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-full text-gray-500 shadow-sm border border-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
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
          {uploadMutation.error?.message || '업로드 중 오류가 발생했습니다.'}
        </div>
      )}
    </div>
  );
}
