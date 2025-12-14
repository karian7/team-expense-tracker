import Dexie, { type Table } from 'dexie';
import type { BudgetEventType, CreateBudgetEventPayload } from '../../types';

// 동기화 상태 머신
export type SyncState = 'pending' | 'syncing' | 'synced' | 'failed';

// Budget Event (Event Sourcing)
export interface BudgetEvent {
  sequence: number; // Primary Key
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
  isLocalOnly?: boolean;
  syncState?: SyncState;
  pendingId?: string;
}

// Settings 인터페이스
export interface Settings {
  key: string; // Primary key
  value: string; // JSON 문자열
}

// SyncMetadata 인터페이스
export interface SyncMetadata {
  key: 'lastSequence'; // 'lastSequence'만 사용
  value: number; // 마지막으로 동기화한 sequence 번호
  lastSyncTime: string;
}

export interface PendingEvent {
  id: string;
  tempSequence: number;
  payload: CreateBudgetEventPayload;
  status: SyncState;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  retryCount?: number; // 재시도 횟수
  lastSyncAttempt?: string; // 마지막 동기화 시도 시간
}

// Dexie Database 클래스 (Event Sourcing)
class ExpenseTrackerDB extends Dexie {
  budgetEvents!: Table<BudgetEvent, number>;
  settings!: Table<Settings, string>;
  syncMetadata!: Table<SyncMetadata, string>;
  pendingEvents!: Table<PendingEvent, string>;

  constructor() {
    super('ExpenseTrackerDB');

    // 스키마 버전 5 (tempSequence 인덱스 추가)
    this.version(5)
      .stores({
        // BudgetEvent: sequence가 primary key, year+month, eventType으로 필터링
        budgetEvents: 'sequence, [year+month], eventType, eventDate, authorName, referenceSequence',

        // Settings: key가 primary key
        settings: 'key',

        // SyncMetadata: key가 primary key
        syncMetadata: 'key',

        // PendingEvents: 로컬 이벤트 큐, tempSequence 인덱스 추가
        pendingEvents: 'id, tempSequence, status, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('budgetEvents')
          .toCollection()
          .modify((event) => {
            if (typeof event.referenceSequence === 'undefined') {
              event.referenceSequence = null;
            }
          });
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
