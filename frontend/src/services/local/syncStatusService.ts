import { db, now, type SyncStatus } from '../db/database';

/**
 * 동기화 상태 추적 서비스
 * UI에 동기화 성공/실패 상태를 표시하기 위한 서비스
 */
export const syncStatusService = {
  /**
   * 동기화 상태 가져오기
   */
  async getStatus(): Promise<SyncStatus | null> {
    const status = await db.syncStatus.get('lastSync');
    return status ?? null;
  },

  /**
   * 동기화 성공 기록
   */
  async recordSuccess(hasPendingEvents: boolean): Promise<void> {
    await db.syncStatus.put({
      key: 'lastSync',
      lastSuccessTime: now(),
      lastErrorTime: null,
      lastErrorMessage: null,
      isPending: hasPendingEvents,
    });
  },

  /**
   * 동기화 실패 기록
   */
  async recordError(errorMessage: string, hasPendingEvents: boolean): Promise<void> {
    const current = await this.getStatus();

    await db.syncStatus.put({
      key: 'lastSync',
      lastSuccessTime: current?.lastSuccessTime ?? null,
      lastErrorTime: now(),
      lastErrorMessage: errorMessage,
      isPending: hasPendingEvents,
    });
  },

  /**
   * pending 상태만 업데이트
   */
  async updatePendingStatus(hasPendingEvents: boolean): Promise<void> {
    const current = await this.getStatus();

    if (current) {
      await db.syncStatus.put({
        ...current,
        isPending: hasPendingEvents,
      });
    } else {
      await db.syncStatus.put({
        key: 'lastSync',
        lastSuccessTime: null,
        lastErrorTime: null,
        lastErrorMessage: null,
        isPending: hasPendingEvents,
      });
    }
  },

  /**
   * 동기화 상태 초기화
   */
  async clear(): Promise<void> {
    await db.syncStatus.delete('lastSync');
  },
};
