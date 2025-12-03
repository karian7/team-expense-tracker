import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exportApi } from '../services/api';

export function useExportExpenses() {
  return useMutation({
    mutationFn: () => exportApi.exportExpenses(),
    onSuccess: (blob) => {
      // 파일 다운로드
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}

export function useDownloadTemplate() {
  return useMutation({
    mutationFn: () => exportApi.downloadTemplate(),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'expense_import_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}

export function useImportExpenses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => exportApi.importExpenses(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}
