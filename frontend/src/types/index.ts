// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Budget Event (Event Sourcing)
export interface BudgetEvent {
  sequence: number;
  eventType: 'BUDGET_IN' | 'EXPENSE';
  eventDate: string;
  year: number;
  month: number;
  authorName: string;
  amount: number;
  storeName: string | null;
  description: string | null;
  receiptImage: string | null;
  ocrRawData: string | null;
  createdAt: string;
}

// Monthly Budget (Computed from events)
export interface MonthlyBudget {
  year: number;
  month: number;
  budgetIn: number;
  previousBalance: number;
  totalBudget: number;
  totalSpent: number;
  balance: number;
  eventCount: number;
}

// Sync Response
export interface SyncEventsResponse {
  lastSequence: number;
  events: BudgetEvent[];
}

// Expense (alias for BudgetEvent with EXPENSE type)
export type Expense = BudgetEvent;

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
  topExpenses: BudgetEvent[];
}

export interface MonthlyReport {
  budget: MonthlyBudget;
  statistics: MonthlyReportStatistics;
}
