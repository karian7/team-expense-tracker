import { Decimal } from '@prisma/client/runtime/library';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Monthly Budget Types
export interface MonthlyBudgetResponse {
  id: string;
  year: number;
  month: number;
  baseAmount: number;
  carriedAmount: number;
  totalBudget: number;
  totalSpent: number;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMonthlyBudgetRequest {
  year: number;
  month: number;
  baseAmount: number;
}

export interface UpdateMonthlyBudgetRequest {
  baseAmount?: number;
}

// Expense Types
export interface ExpenseResponse {
  id: string;
  monthlyBudgetId: string;
  authorName: string;
  amount: number;
  expenseDate: Date;
  storeName: string | null;
  receiptImageUrl: string;
  ocrRawData: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseRequest {
  authorName: string;
  amount: number;
  expenseDate: string; // ISO date string
  storeName?: string;
  receiptImageUrl: string;
  ocrRawData?: any;
}

export interface UpdateExpenseRequest {
  authorName?: string;
  amount?: number;
  expenseDate?: string;
  storeName?: string;
}

// OCR Types
export interface OcrResult {
  amount: number | null;
  date: string | null;
  storeName: string | null;
  confidence: number;
  rawText?: string;
  error?: string;
}

export interface ReceiptUploadResponse {
  imageUrl: string;
  ocrResult: OcrResult;
}

// Query Parameters
export interface ExpenseQueryParams {
  year?: string;
  month?: string;
  authorName?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

// Settings Types
export interface AppSettings {
  defaultMonthlyBudget: number;
  initialBudget: number;
}

export interface UpdateSettingsRequest {
  defaultMonthlyBudget?: number;
}

// Export/Import Types
export interface ImportResult {
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: string[];
}

// Utility type to convert Decimal to number
export type DecimalToNumber<T> = {
  [K in keyof T]: T[K] extends Decimal ? number : T[K];
};

// Monthly Report Types
export interface DailyBreakdown {
  date: string;
  amount: number;
  count: number;
}

export interface AuthorBreakdown {
  authorName: string;
  amount: number;
  count: number;
}

export interface MonthlyReportResponse {
  budget: MonthlyBudgetResponse;
  statistics: {
    totalExpenses: number;
    expenseCount: number;
    dailyBreakdown: DailyBreakdown[];
    authorBreakdown: AuthorBreakdown[];
    topExpenses: ExpenseResponse[];
  };
}