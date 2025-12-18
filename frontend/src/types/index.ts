export type BudgetEventType =
  | 'BUDGET_IN'
  | 'EXPENSE'
  | 'EXPENSE_REVERSAL'
  | 'BUDGET_ADJUSTMENT_INCREASE'
  | 'BUDGET_ADJUSTMENT_DECREASE'
  | 'BUDGET_RESET';

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
  eventType: BudgetEventType;
  eventDate: string;
  year: number;
  month: number;
  authorName: string;
  amount: number;
  storeName: string | null;
  description: string | null;
  receiptImage: string | null;
  ocrRawData: string | null;
  referenceSequence: number | null;
  createdAt: string;
  /** 로컬에서만 존재하는 임시 이벤트 여부 */
  isLocalOnly?: boolean;
  /** 동기화 대기 상태 */
  syncState?: 'pending' | 'syncing' | 'synced' | 'failed';
  /** 대기 큐 식별자 */
  pendingId?: string;
}

export interface CreateBudgetEventPayload {
  eventType: BudgetEventType;
  eventDate: string;
  year: number;
  month: number;
  authorName: string;
  amount: number;
  storeName?: string;
  description?: string;
  receiptImage?: string;
  ocrRawData?: Record<string, unknown> | OcrResult;
  referenceSequence?: number | null;
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
  isReceipt?: boolean; // 이미지가 영수증인지 여부
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
  description?: string;
  receiptImage: string; // base64 encoded
  ocrRawData?: OcrResult | Record<string, unknown>;
}

// Settings
export interface AppSettings {
  defaultMonthlyBudget: number;
  initialBudget: number;
  needsFullSync: boolean;
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

// Push Notification
export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    expenseSequence?: number;
    [key: string]: unknown;
  };
}
