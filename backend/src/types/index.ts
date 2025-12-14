import { Decimal } from '@prisma/client/runtime/library';

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
}

// Computed Monthly Budget (client-side calculation result)
export interface MonthlyBudgetResponse {
  year: number;
  month: number;
  budgetIn: number; // 이번 달 예산 유입 (BASE_BUDGET)
  previousBalance: number; // 이전 달 잔액 (계산된 값, 이벤트 아님!)
  totalBudget: number; // previousBalance + budgetIn
  totalSpent: number; // 이번 달 지출
  balance: number; // totalBudget - totalSpent
  eventCount: number;
}

// Expense Types (now derived from BudgetEvent)
export type ExpenseResponse = BudgetEventResponse;

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

// Utility type to convert Decimal to number
export type DecimalToNumber<T> = {
  [K in keyof T]: T[K] extends Decimal ? number : T[K];
};
