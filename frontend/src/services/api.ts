import axios from 'axios';
import type {
  ApiResponse,
  MonthlyBudget,
  Expense,
  ReceiptUploadResponse,
  ExpenseFormData,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
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
    updates: Partial<Omit<ExpenseFormData, 'receiptImageUrl' | 'ocrRawData'>>
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

  parse: async (imageUrl: string): Promise<ReceiptUploadResponse> => {
    const { data } = await apiClient.post<ApiResponse<ReceiptUploadResponse>>('/receipts/parse', {
      imageUrl,
    });
    return data.data!;
  },
};

export default apiClient;
