import axios from 'axios';
import type {
  ApiResponse,
  MonthlyBudget,
  Expense,
  ReceiptUploadResponse,
  ExpenseFormData,
  AppSettings,
  ImportResult,
  MonthlyReport,
} from '../types';

const inferBackendOrigin = () => {
  const { protocol, hostname, port } = window.location;
  const targetPort = port && port !== '80' && port !== '443' ? '3001' : port || '3001';
  return `${protocol}//${hostname}:${targetPort}`;
};

export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? inferBackendOrigin()).replace(/\/$/, '');

const apiClient = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Budget API
export const budgetApi = {
  getCurrent: async (): Promise<MonthlyBudget> => {
    const { data } = await apiClient.get<ApiResponse<MonthlyBudget>>('/monthly-budgets/current');
    return data.data!;
  },

  getByMonth: async (year: number, month: number): Promise<MonthlyBudget> => {
    const { data } = await apiClient.get<ApiResponse<MonthlyBudget>>(
      `/monthly-budgets/${year}/${month}`
    );
    return data.data!;
  },

  getReport: async (year: number, month: number): Promise<MonthlyReport> => {
    const { data } = await apiClient.get<ApiResponse<MonthlyReport>>(
      `/monthly-budgets/${year}/${month}/report`
    );
    return data.data!;
  },

  updateBaseAmount: async (
    year: number,
    month: number,
    baseAmount: number
  ): Promise<MonthlyBudget> => {
    const { data } = await apiClient.put<ApiResponse<MonthlyBudget>>(
      `/monthly-budgets/${year}/${month}`,
      { baseAmount }
    );
    return data.data!;
  },
};

// Expense API
export const expenseApi = {
  list: async (params?: {
    year?: number;
    month?: number;
    authorName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Expense[]> => {
    const { data } = await apiClient.get<ApiResponse<Expense[]>>('/expenses', { params });
    return data.data!;
  },

  getById: async (id: string): Promise<Expense> => {
    const { data } = await apiClient.get<ApiResponse<Expense>>(`/expenses/${id}`);
    return data.data!;
  },

  create: async (expense: ExpenseFormData): Promise<Expense> => {
    const { data } = await apiClient.post<ApiResponse<Expense>>('/expenses', expense);
    return data.data!;
  },

  update: async (
    id: string,
    updates: Partial<Omit<ExpenseFormData, 'receiptImage' | 'ocrRawData'>>
  ): Promise<Expense> => {
    const { data } = await apiClient.put<ApiResponse<Expense>>(`/expenses/${id}`, updates);
    return data.data!;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/expenses/${id}`);
  },
};

// Receipt API
export const receiptApi = {
  upload: async (file: File): Promise<ReceiptUploadResponse> => {
    const formData = new FormData();
    formData.append('receipt', file);

    const { data } = await apiClient.post<ApiResponse<ReceiptUploadResponse>>(
      '/receipts/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data.data!;
  },

  parse: async (imageBlob: string): Promise<ReceiptUploadResponse> => {
    const { data } = await apiClient.post<ApiResponse<ReceiptUploadResponse>>('/receipts/parse', {
      imageBlob,
    });
    return data.data!;
  },
};

// Settings API
export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await apiClient.get<ApiResponse<AppSettings>>('/settings');
    return data.data!;
  },

  update: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const { data } = await apiClient.put<ApiResponse<AppSettings>>('/settings', settings);
    return data.data!;
  },

  setInitialBudget: async (initialBudget: number): Promise<AppSettings> => {
    const { data } = await apiClient.post<ApiResponse<AppSettings>>('/settings/initial-budget', {
      initialBudget,
    });
    return data.data!;
  },
};

// Export/Import API
export const exportApi = {
  exportExpenses: async (): Promise<Blob> => {
    const { data } = await apiClient.get('/export/expenses', {
      responseType: 'blob',
    });
    return data;
  },

  downloadTemplate: async (): Promise<Blob> => {
    const { data } = await apiClient.get('/export/template', {
      responseType: 'blob',
    });
    return data;
  },

  importExpenses: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<ApiResponse<ImportResult>>('/import/expenses', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data.data!;
  },
};

export default apiClient;
