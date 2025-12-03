import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { useExportExpenses, useDownloadTemplate, useImportExpenses } from '../hooks/useExport';
import { formatCurrency } from '../utils/format';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const exportMutation = useExportExpenses();
  const templateMutation = useDownloadTemplate();
  const importMutation = useImportExpenses();

  const [defaultBudget, setDefaultBudget] = useState<number>(0);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    if (settings) {
      setDefaultBudget(settings.defaultMonthlyBudget);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    try {
      await updateMutation.mutateAsync({
        defaultMonthlyBudget: defaultBudget,
      });
      alert('설정이 저장되었습니다.');
    } catch (error) {
      console.error('Save error:', error);
      alert('설정 저장에 실패했습니다.');
    }
  };

  const handleExport = () => {
    exportMutation.mutate();
  };

  const handleDownloadTemplate = () => {
    templateMutation.mutate();
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('CSV 파일을 선택해주세요.');
      return;
    }

    try {
      const result = await importMutation.mutateAsync(importFile);

      if (result.failed > 0) {
        alert(
          `Import 완료\n성공: ${result.success}건\n실패: ${result.failed}건\n\n실패 내역:\n${result.errors.slice(0, 5).join('\n')}`
        );
      } else {
        alert(`Import 완료\n성공: ${result.success}건`);
      }

      setImportFile(null);
    } catch (error) {
      console.error('Import error:', error);
      alert('Import에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full mx-4 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">설정</h2>
          <button
            onClick={onClose}
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

        <div className="p-6 space-y-8">
          {/* 기본 예산 설정 */}
          <section>
            <h3 className="text-lg font-semibold mb-4">기본 회식비 설정</h3>
            <div className="card">
              <p className="text-sm text-gray-600 mb-4">
                매월 자동으로 생성되는 기본 회식비 금액을 설정합니다.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  월별 기본 예산
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={defaultBudget}
                    onChange={(e) => setDefaultBudget(parseFloat(e.target.value) || 0)}
                    className="input-field pr-12"
                    placeholder="500000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    원
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  현재: {formatCurrency(settings?.defaultMonthlyBudget || 0)}
                </p>
              </div>

              <button
                onClick={handleSaveSettings}
                className="btn-primary w-full"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? '저장 중...' : '설정 저장'}
              </button>
            </div>
          </section>

          {/* CSV Export */}
          <section>
            <h3 className="text-lg font-semibold mb-4">데이터 내보내기</h3>
            <div className="card">
              <p className="text-sm text-gray-600 mb-4">
                모든 사용 내역을 CSV 파일로 다운로드합니다.
              </p>

              <button
                onClick={handleExport}
                className="btn-secondary w-full"
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? '다운로드 중...' : '📥 CSV 다운로드'}
              </button>
            </div>
          </section>

          {/* CSV Import */}
          <section>
            <h3 className="text-lg font-semibold mb-4">데이터 가져오기</h3>
            <div className="card">
              <p className="text-sm text-gray-600 mb-4">
                CSV 파일을 업로드하여 사용 내역을 일괄 등록합니다.
              </p>

              <div className="mb-4">
                <button
                  onClick={handleDownloadTemplate}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  disabled={templateMutation.isPending}
                >
                  📄 템플릿 다운로드
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV 파일 선택
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="input-field"
                />
                {importFile && (
                  <p className="text-xs text-gray-600 mt-1">
                    선택된 파일: {importFile.name}
                  </p>
                )}
              </div>

              <button
                onClick={handleImport}
                className="btn-primary w-full"
                disabled={!importFile || importMutation.isPending}
              >
                {importMutation.isPending ? '업로드 중...' : '📤 CSV 업로드'}
              </button>

              {importMutation.isError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">
                    Import 실패: {importMutation.error?.message || '알 수 없는 오류'}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* CSV 형식 안내 */}
          <section>
            <h3 className="text-lg font-semibold mb-4">CSV 파일 형식</h3>
            <div className="card bg-gray-50">
              <p className="text-sm text-gray-700 mb-2 font-medium">
                다음 형식으로 작성해주세요:
              </p>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`작성자,금액,사용날짜(YYYY-MM-DD),상호명
홍길동,50000,2024-12-03,맛있는식당
김철수,35000,2024-12-02,카페`}
              </pre>
              <p className="text-xs text-gray-600 mt-2">
                ⚠️ 첫 줄은 헤더이므로 제외하고 두 번째 줄부터 데이터를 입력해주세요.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
