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

// Budget Event Types (복식부기 원칙)
export interface BudgetEventResponse {
  sequence: number;
  eventType: BudgetEventType; // 예산 유입 | 지출 | 조정 | 취소
  eventDate: Date;
  year: number;
  month: number;
  authorName: string;
  amount: number; // 항상 양수
  storeName: string | null;
  description: string | null;
  receiptImage: string | null; // base64 encoded image
  ocrRawData: string | null;
  referenceSequence: number | null;
  createdAt: Date;
}

export interface CreateBudgetEventRequest {
  eventType: BudgetEventType;
  eventDate: string; // ISO date string
  year: number;
  month: number;
  authorName: string;
  amount: number; // 항상 양수
  storeName?: string;
  description?: string;
  receiptImage?: string; // base64 encoded image
  ocrRawData?: Record<string, unknown>;
  referenceSequence?: number | null;
}

// Sync API Types
export interface SyncEventsResponse {
  lastSequence: number;
  events: BudgetEventResponse[];
  needsFullSync: boolean;
}

// OCR Types
export interface OcrResult {
  amount: number | null;
  date: string | null; // ISO datetime string (YYYY-MM-DDTHH:mm:ss.sssZ)
  storeName: string | null;
  confidence: number;
  rawText?: string;
  error?: string;
}

export interface ReceiptUploadResponse {
  imageId: string;
  imageBuffer: string; // base64 encoded
  ocrResult: OcrResult;
}

// Settings Types
export interface AppSettings {
  defaultMonthlyBudget: number;
  initialBudget: number;
}

export interface UpdateSettingsRequest {
  defaultMonthlyBudget?: number;
}

// Push Notification Types
export interface PushSubscriptionRequest {
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
    [key: string]: unknown;
  };
}
