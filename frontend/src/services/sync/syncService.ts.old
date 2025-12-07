/**
 * 동기화 서비스
 * Pull (서버 → 클라이언트) 및 Push (클라이언트 → 서버) 오케스트레이션
 */

import { db } from '../db/database';
import { syncQueue } from './syncQueue';
import { conflictResolver } from './conflictResolver';
import type { PullRequest, PullResponse, PushRequest, PushResponse, SyncStatus } from './types';

/**
 * Sync API 베이스 URL
 * TODO: 환경변수로 설정
 */
const SYNC_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Pull: 서버에서 변경사항 가져오기
 */
export async function pull(): Promise<void> {
  try {
    // 각 엔티티의 마지막 동기화 시간 조회
    const metadata = await db.syncMetadata.toArray();
    const lastSyncTime: Record<string, string> = {};

    for (const m of metadata) {
      lastSyncTime[m.entity] = m.lastSyncTime || '';
    }

    // Pull 요청
    const request: PullRequest = {
      entities: ['budgets', 'expenses', 'settings'],
      lastSyncTime: lastSyncTime as PullRequest['lastSyncTime'],
    };

    const response = await fetch(`${SYNC_API_URL}/api/sync/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const data: PullResponse = await response.json();

    // 서버 데이터를 로컬에 병합
    await mergeServerData(data);

    // 마지막 동기화 시간 업데이트
    await updateLastSyncTime(data.syncTime);
  } catch (error) {
    console.error('Pull error:', error);
    throw error;
  }
}

/**
 * 서버 데이터를 로컬 DB에 병합
 */
async function mergeServerData(data: PullResponse): Promise<void> {
  // Budgets 병합
  for (const budget of data.budgets) {
    const existing = await db.monthlyBudgets.get(budget.id);

    // 서버 데이터에 필수 필드 추가
    const budgetWithDefaults = {
      ...budget,
      version: budget.version ?? 1,
      deleted: budget.deleted ?? false,
    };

    if (!existing) {
      // 신규 항목: 추가
      await db.monthlyBudgets.add(budgetWithDefaults);
    } else {
      // 기존 항목: LWW로 판단
      const serverTime = new Date(budget.updatedAt).getTime();
      const localTime = new Date(existing.updatedAt).getTime();

      if (serverTime > localTime) {
        // 서버가 더 최신
        await db.monthlyBudgets.put(budgetWithDefaults);
      } else if (serverTime === localTime && budgetWithDefaults.version > existing.version) {
        // 시간 동일하면 버전으로 판단
        await db.monthlyBudgets.put(budgetWithDefaults);
      }
      // 클라이언트가 더 최신이면 무시 (다음 push에서 서버로 전송됨)
    }
  }

  // Expenses 병합
  for (const expense of data.expenses) {
    const existing = await db.expenses.get(expense.id);

    // 서버 데이터에 필수 필드 추가
    const expenseWithDefaults = {
      ...expense,
      version: expense.version ?? 1,
      deleted: expense.deleted ?? false,
    };

    if (!existing) {
      await db.expenses.add(expenseWithDefaults);
    } else {
      const serverTime = new Date(expense.updatedAt).getTime();
      const localTime = new Date(existing.updatedAt).getTime();

      if (serverTime > localTime) {
        await db.expenses.put(expenseWithDefaults);
      } else if (serverTime === localTime && expenseWithDefaults.version > existing.version) {
        await db.expenses.put(expenseWithDefaults);
      }
    }
  }

  // Settings 병합
  for (const setting of data.settings) {
    const existing = await db.settings.get(setting.key);

    // 서버 데이터에 필수 필드 추가
    const settingWithDefaults = {
      ...setting,
      version: setting.version ?? 1,
      deleted: setting.deleted ?? false,
    };

    if (!existing) {
      await db.settings.add(settingWithDefaults);
    } else {
      const serverTime = new Date(setting.updatedAt).getTime();
      const localTime = new Date(existing.updatedAt).getTime();

      if (serverTime > localTime) {
        await db.settings.put(settingWithDefaults);
      } else if (serverTime === localTime && settingWithDefaults.version > existing.version) {
        await db.settings.put(settingWithDefaults);
      }
    }
  }
}

/**
 * Push: 로컬 변경사항을 서버로 전송
 */
export async function push(): Promise<void> {
  try {
    // 동기화 큐에서 모든 변경사항 가져오기
    const queue = await syncQueue.dequeue();

    if (queue.length === 0) {
      // 변경사항 없음
      return;
    }

    // Push 요청 데이터 생성
    const changes = queue.map((item) => ({
      entity: item.entity as 'budgets' | 'expenses' | 'settings',
      operation: item.operation as 'create' | 'update' | 'delete',
      data: JSON.parse(item.data),
    }));

    const request: PushRequest = { changes };

    const response = await fetch(`${SYNC_API_URL}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.statusText}`);
    }

    const data: PushResponse = await response.json();

    // 성공한 항목 큐에서 제거
    for (const accepted of data.accepted) {
      const queueItem = queue.find((q) => q.entityId === accepted.id);
      if (queueItem) {
        await syncQueue.remove(queueItem.id);
      }
    }

    // 충돌 해결
    if (data.conflicts.length > 0) {
      await conflictResolver.resolveConflicts(data.conflicts);

      // 충돌 해결 후 해당 항목 큐에서 제거
      for (const conflict of data.conflicts) {
        const queueItem = queue.find((q) => q.entityId === conflict.id);
        if (queueItem) {
          await syncQueue.remove(queueItem.id);
        }
      }
    }

    // 마지막 동기화 시간 업데이트
    await updateLastSyncTime(data.syncTime);
  } catch (error) {
    console.error('Push error:', error);
    throw error;
  }
}

/**
 * 전체 동기화: Pull + Push
 */
export async function syncAll(): Promise<void> {
  try {
    // Pull 먼저 (서버 변경사항 가져오기)
    await pull();

    // Push (로컬 변경사항 전송)
    await push();
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}

/**
 * 마지막 동기화 시간 업데이트
 */
async function updateLastSyncTime(syncTime: string): Promise<void> {
  const entities: Array<'budgets' | 'expenses' | 'settings'> = ['budgets', 'expenses', 'settings'];

  for (const entity of entities) {
    const metadata = await db.syncMetadata.get(entity);
    if (metadata) {
      await db.syncMetadata.update(entity, { lastSyncTime: syncTime });
    } else {
      await db.syncMetadata.add({
        entity,
        lastSyncTime: syncTime,
        pendingChanges: 0,
      });
    }
  }
}

/**
 * 동기화 상태 조회
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const metadata = await db.syncMetadata.toArray();
  const pendingChanges = await syncQueue.getPendingCount();

  const lastSyncTimes = metadata.map((m) => new Date(m.lastSyncTime).getTime()).filter(Boolean);
  const lastSyncTime =
    lastSyncTimes.length > 0 ? new Date(Math.max(...lastSyncTimes)).toISOString() : null;

  return {
    lastSyncTime,
    isSyncing: false, // TODO: 실제 동기화 중 상태 추적
    pendingChanges,
    lastError: null, // TODO: 에러 추적
  };
}

export const syncService = {
  pull,
  push,
  syncAll,
  getSyncStatus,
};
