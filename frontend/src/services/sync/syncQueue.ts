/**
 * 동기화 큐 관리
 * 로컬 변경사항을 추적하고 서버와 동기화할 준비를 합니다
 */

import { db, generateId, now, type SyncQueueItem as DBSyncQueueItem } from '../db/database';
import type { SyncEntity, SyncOperation } from './types';

/**
 * 동기화 큐에 항목 추가
 */
export async function enqueue(
  entity: SyncEntity,
  operation: SyncOperation,
  entityId: string,
  data: unknown
): Promise<void> {
  const queueItem: DBSyncQueueItem = {
    id: generateId(),
    entity,
    operation,
    entityId,
    data: JSON.stringify(data),
    timestamp: now(),
    retryCount: 0,
  };

  await db.syncQueue.add(queueItem);

  // SyncMetadata 업데이트
  const metadata = await db.syncMetadata.get(entity);
  if (metadata) {
    await db.syncMetadata.update(entity, {
      pendingChanges: metadata.pendingChanges + 1,
    });
  } else {
    await db.syncMetadata.add({
      entity,
      lastSyncTime: '',
      pendingChanges: 1,
    });
  }
}

/**
 * 동기화 큐에서 모든 항목 가져오기
 */
export async function dequeue(): Promise<DBSyncQueueItem[]> {
  return db.syncQueue.orderBy('timestamp').toArray();
}

/**
 * 특정 엔티티의 큐 항목 가져오기
 */
export async function getByEntity(entity: SyncEntity): Promise<DBSyncQueueItem[]> {
  return db.syncQueue.where('entity').equals(entity).sortBy('timestamp');
}

/**
 * 큐에서 항목 제거 (동기화 성공 후)
 */
export async function remove(id: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.delete(id);

    // SyncMetadata 업데이트
    const metadata = await db.syncMetadata.get(item.entity);
    if (metadata && metadata.pendingChanges > 0) {
      await db.syncMetadata.update(item.entity, {
        pendingChanges: metadata.pendingChanges - 1,
      });
    }
  }
}

/**
 * 재시도 횟수 증가 및 에러 메시지 기록
 */
export async function retry(id: string, error: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, {
      retryCount: item.retryCount + 1,
      lastError: error,
    });
  }
}

/**
 * 특정 엔티티의 큐 초기화
 */
export async function clearEntity(entity: SyncEntity): Promise<void> {
  const items = await db.syncQueue.where('entity').equals(entity).toArray();
  await db.syncQueue.bulkDelete(items.map((i) => i.id));

  await db.syncMetadata.update(entity, {
    pendingChanges: 0,
  });
}

/**
 * 전체 큐 초기화
 */
export async function clearAll(): Promise<void> {
  await db.syncQueue.clear();

  // 모든 SyncMetadata의 pendingChanges를 0으로
  const allMetadata = await db.syncMetadata.toArray();
  for (const metadata of allMetadata) {
    await db.syncMetadata.update(metadata.entity, {
      pendingChanges: 0,
    });
  }
}

/**
 * 대기 중인 변경사항 수 조회
 */
export async function getPendingCount(entity?: SyncEntity): Promise<number> {
  if (entity) {
    return db.syncQueue.where('entity').equals(entity).count();
  }
  return db.syncQueue.count();
}

export const syncQueue = {
  enqueue,
  dequeue,
  getByEntity,
  remove,
  retry,
  clearEntity,
  clearAll,
  getPendingCount,
};
