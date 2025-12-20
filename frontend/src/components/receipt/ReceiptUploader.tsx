import { useState, useRef, useEffect } from 'react';
import { useUploadReceipt } from '../../hooks/useReceipt';
import { receiptStorageService } from '../../services/local/receiptStorageService';
import type { ReceiptUploadResponse } from '../../types';

interface ReceiptUploaderProps {
  onUploadSuccess: (result: ReceiptUploadResponse) => void;
  onUploadError?: (error: Error) => void;
}

export default function ReceiptUploader({ onUploadSuccess, onUploadError }: ReceiptUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasLastReceipt, setHasLastReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadReceipt();

  // 마지막 영수증 이미지 확인
  useEffect(() => {
    receiptStorageService.hasLastReceipt().then(setHasLastReceipt);
  }, []);

  const handleFileSelect = async (file: File) => {
    // 파일 미리보기
    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageData = reader.result as string;
      setPreview(imageData);

      // 로컬에 이미지 저장 (재시도용)
      await receiptStorageService.saveLastReceipt(imageData, file.name);
      setHasLastReceipt(true);
    };
    reader.readAsDataURL(file);

    // 파일 업로드 및 OCR
    try {
      const result = await uploadMutation.mutateAsync(file);
      onUploadSuccess(result);
      // 성공 시 로컬 이미지 삭제
      await receiptStorageService.clearLastReceipt();
      setHasLastReceipt(false);
    } catch (error) {
      console.error('Upload error:', error);
      if (onUploadError) {
        onUploadError(error as Error);
      }
    }
  };

  const handleRetryUpload = async () => {
    try {
      const lastReceipt = await receiptStorageService.getLastReceipt();
      if (!lastReceipt) {
        console.warn('[ReceiptUploader] 재시도할 영수증 이미지가 없습니다');
        return;
      }

      // base64를 Blob으로 변환
      const response = await fetch(lastReceipt.imageData);
      const blob = await response.blob();

      // MIME 타입 검증 (이미지가 아니면 기본값 사용)
      const mimeType = blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
      const file = new File([blob], lastReceipt.fileName, { type: mimeType });

      console.log('[ReceiptUploader] 영수증 재시도:', {
        fileName: lastReceipt.fileName,
        size: blob.size,
        type: mimeType,
      });

      // 업로드 재시도
      const result = await uploadMutation.mutateAsync(file);
      onUploadSuccess(result);

      // 성공 시 로컬 이미지 삭제
      await receiptStorageService.clearLastReceipt();
      setHasLastReceipt(false);
    } catch (error) {
      console.error('[ReceiptUploader] 재시도 실패:', error);
      if (onUploadError) {
        onUploadError(error as Error);
      }
    }
  };

  const handleLoadLastReceipt = async () => {
    try {
      const lastReceipt = await receiptStorageService.getLastReceipt();
      if (!lastReceipt) {
        console.warn('[ReceiptUploader] 불러올 영수증 이미지가 없습니다');
        return;
      }

      setPreview(lastReceipt.imageData);
      console.log('[ReceiptUploader] 저장된 영수증 로드:', lastReceipt.fileName);
    } catch (error) {
      console.error('[ReceiptUploader] 영수증 로드 실패:', error);
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

  const handleClearPreview = async () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClearLastReceipt = async () => {
    try {
      await receiptStorageService.clearLastReceipt();
      setHasLastReceipt(false);
      setPreview(null);
      console.log('[ReceiptUploader] 저장된 영수증 삭제 완료');
    } catch (error) {
      console.error('[ReceiptUploader] 영수증 삭제 실패:', error);
      // 삭제 실패해도 UI 상태는 초기화
      setHasLastReceipt(false);
      setPreview(null);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* 마지막 영수증 복구 버튼 */}
      {hasLastReceipt && !preview && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <p className="text-sm text-blue-700 font-medium">
              마지막 업로드한 영수증 이미지가 저장되어 있습니다
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLoadLastReceipt}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              불러오기
            </button>
            <button
              onClick={handleClearLastReceipt}
              className="text-sm px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      )}

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
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
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
            <span>{uploadMutation.error?.message || '업로드 중 오류가 발생했습니다.'}</span>
          </div>
          <button
            onClick={handleRetryUpload}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
