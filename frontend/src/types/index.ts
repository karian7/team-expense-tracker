// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Monthly Budget
export interface MonthlyBudget {
  id: string;
  year: number;
  month: number;
  baseAmount: number;
  carriedAmount: number;
  totalBudget: number;
  totalSpent: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

// Expense
export interface Expense {
  id: string;
  monthlyBudgetId: string;
  authorName: string;
  amount: number;
  expenseDate: string;
  storeName: string | null;
  receiptImageUrl: string;
  ocrRawData: any;
  createdAt: string;
  updatedAt: string;
}

// OCR Result
export interface OcrResult {
  amount: number | null;
  date: string | null;
  storeName: string | null;
  confidence: number;
  rawText?: string;
  error?: string;
}

// Receipt Upload Response
export interface ReceiptUploadResponse {
  imageUrl: string;
  ocrResult: OcrResult;
}

// Form Types
export interface ExpenseFormData {
  authorName: string;
  amount: number;
  expenseDate: string;
  storeName?: string;
  receiptImageUrl: string;
  ocrRawData?: any;
}

// Settings
export interface AppSettings {
  defaultMonthlyBudget: number;
}

// Import Result
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}
