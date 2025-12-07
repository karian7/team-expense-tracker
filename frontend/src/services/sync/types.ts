/**
 * 동기화 관련 타입 정의
 */

import type { MonthlyBudget, Expense, Settings } from '../db/database';

/**
 * 동기화 가능한 엔티티 타입
 */
export type SyncEntity = 'budgets' | 'expenses' | 'settings';

/**
 * 동기화 작업 타입
 */
export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * 동기화 큐 아이템
 */
export interface SyncQueueItem {
  id: string; // 큐 아이템 고유 ID
  entity: SyncEntity;
  operation: SyncOperation;
  entityId: string; // 실제 엔티티 ID
  data: MonthlyBudget | Expense | Settings;
  timestamp: string; // ISO timestamp
  retryCount: number;
  lastError?: string;
}

/**
 * Pull 요청 데이터
 */
export interface PullRequest {
  entities: SyncEntity[];
  lastSyncTime: Record<SyncEntity, string>; // 각 엔티티의 마지막 동기화 시간
}

/**
 * Pull 응답 데이터
 */
export interface PullResponse {
  budgets: MonthlyBudget[];
  expenses: Expense[];
  settings: Settings[];
  syncTime: string; // 서버의 현재 시간
}

/**
 * Push 요청 데이터
 */
export interface PushRequest {
  changes: Array<{
    entity: SyncEntity;
    operation: SyncOperation;
    data: MonthlyBudget | Expense | Settings;
  }>;
}

/**
 * Push 응답 - 충돌 정보
 */
export interface Conflict {
  id: string;
  entity: SyncEntity;
  clientVersion: {
    updatedAt: string;
    version: number;
    data: MonthlyBudget | Expense | Settings;
  };
  serverVersion: {
    updatedAt: string;
    version: number;
    data: MonthlyBudget | Expense | Settings;
  };
  resolution: 'server_wins' | 'client_wins';
}

/**
 * Push 응답 데이터
 */
export interface PushResponse {
  accepted: Array<{
    id: string;
    status: 'success';
  }>;
  conflicts: Conflict[];
  syncTime: string;
}

/**
 * 동기화 상태
 */
export interface SyncStatus {
  lastSyncTime: string | null;
  isSyncing: boolean;
  pendingChanges: number;
  lastError: string | null;
}
