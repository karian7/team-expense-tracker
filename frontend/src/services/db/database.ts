import Dexie, { type Table } from 'dexie';

// 동기화 가능한 엔티티 인터페이스
export interface SyncableEntity {
  updatedAt: string; // ISO timestamp
  version: number; // Optimistic locking
  deleted: boolean; // Soft delete
}

// MonthlyBudget 인터페이스
export interface MonthlyBudget extends SyncableEntity {
  id: string;
  year: number;
  month: number;
  baseAmount: number;
  carriedAmount: number;
  totalBudget: number;
  totalSpent: number;
  balance: number;
  createdAt: string;
}

// Expense 인터페이스
export interface Expense extends SyncableEntity {
  id: string;
  monthlyBudgetId: string;
  authorName: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD 형식
  storeName?: string;
  receiptImageUrl: string;
  receiptImageBlob?: Blob; // 로컬 저장용
  ocrRawData?: string; // JSON 문자열
  createdAt: string;
}

// Settings 인터페이스
export interface Settings extends SyncableEntity {
  key: string; // Primary key
  value: string; // JSON 문자열
}

// SyncMetadata 인터페이스
export interface SyncMetadata {
  entity: 'expenses' | 'budgets' | 'settings';
  lastSyncTime: string;
  pendingChanges: number;
}

// SyncQueue 인터페이스 (동기화 대기 중인 변경사항)
export interface SyncQueueItem {
  id: string; // 큐 아이템 고유 ID
  entity: 'budgets' | 'expenses' | 'settings';
  operation: 'create' | 'update' | 'delete';
  entityId: string; // 실제 엔티티 ID
  data: string; // JSON 직렬화된 데이터
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

// Dexie Database 클래스
class ExpenseTrackerDB extends Dexie {
  monthlyBudgets!: Table<MonthlyBudget, string>;
  expenses!: Table<Expense, string>;
  settings!: Table<Settings, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('ExpenseTrackerDB');

    // 스키마 버전 1
    this.version(1).stores({
      // MonthlyBudget: id로 조회, [year+month] 복합 인덱스, updatedAt, deleted로 필터링
      monthlyBudgets: 'id, [year+month], updatedAt, deleted',

      // Expense: id로 조회, monthlyBudgetId, expenseDate, authorName으로 필터링
      expenses: 'id, monthlyBudgetId, expenseDate, authorName, updatedAt, deleted',

      // Settings: key가 primary key
      settings: 'key, updatedAt',

      // SyncMetadata: entity가 primary key
      syncMetadata: 'entity',

      // SyncQueue: 동기화 큐
      syncQueue: 'id, entity, timestamp, retryCount',
    });
  }
}

// 데이터베이스 인스턴스 생성 및 export
export const db = new ExpenseTrackerDB();

// 유틸리티 함수: 새로운 타임스탬프 생성
export function now(): string {
  return new Date().toISOString();
}

// 유틸리티 함수: UUID 생성 (간단한 버전)
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
