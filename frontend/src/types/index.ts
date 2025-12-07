// API Response Types
export interface ApiResponse<T = unknown> {
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
  receiptImageUrl?: string; // deprecated
  receiptImage: string | null; // base64 encoded
  ocrRawData: string | null;
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
  imageId: string;
  imageBuffer: string; // base64 encoded
  ocrResult: OcrResult;
}

// Form Types
export interface ExpenseFormData {
  authorName: string;
  amount: number;
  expenseDate: string;
  storeName?: string;
  receiptImage: string; // base64 encoded
  ocrRawData?: OcrResult | Record<string, unknown>;
}

// Settings
export interface AppSettings {
  defaultMonthlyBudget: number;
  initialBudget: number;
}

// Import Result
export interface ImportResult {
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: string[];
}

// Monthly Report
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

export interface MonthlyReportStatistics {
  totalExpenses: number;
  expenseCount: number;
  dailyBreakdown: DailyBreakdown[];
  authorBreakdown: AuthorBreakdown[];
  topExpenses: Expense[];
}

export interface MonthlyReport {
  budget: MonthlyBudget;
  statistics: MonthlyReportStatistics;
}
