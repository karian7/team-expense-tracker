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
    try {
      const status = await db.syncStatus.get('lastSync');
      return status ?? null;
    } catch (error) {
      console.error('[SyncStatus] 상태 조회 실패:', error);
      return null;
    }
  },

  /**
   * 동기화 성공 기록
   */
  async recordSuccess(hasPendingEvents: boolean): Promise<void> {
    try {
      await db.syncStatus.put({
        key: 'lastSync',
        lastSuccessTime: now(),
        lastErrorTime: null,
        lastErrorMessage: null,
        isPending: hasPendingEvents,
      });
      console.log('[SyncStatus] 동기화 성공 기록:', { hasPendingEvents });
    } catch (error) {
      console.error('[SyncStatus] 성공 기록 실패:', error);
      // UI 표시용 상태이므로 실패해도 동기화 자체에는 영향 없음
    }
  },

  /**
   * 동기화 실패 기록
   */
  async recordError(errorMessage: string, hasPendingEvents: boolean): Promise<void> {
    try {
      const current = await this.getStatus();

      await db.syncStatus.put({
        key: 'lastSync',
        lastSuccessTime: current?.lastSuccessTime ?? null,
        lastErrorTime: now(),
        lastErrorMessage: errorMessage,
        isPending: hasPendingEvents,
      });
      console.error('[SyncStatus] 동기화 실패 기록:', errorMessage);
    } catch (error) {
      console.error('[SyncStatus] 실패 기록 실패:', error);
    }
  },

  /**
   * pending 상태만 업데이트
   */
  async updatePendingStatus(hasPendingEvents: boolean): Promise<void> {
    try {
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
    } catch (error) {
      console.error('[SyncStatus] pending 상태 업데이트 실패:', error);
    }
  },

  /**
   * 동기화 상태 초기화
   */
  async clear(): Promise<void> {
    try {
      await db.syncStatus.delete('lastSync');
      console.log('[SyncStatus] 상태 초기화 완료');
    } catch (error) {
      console.error('[SyncStatus] 상태 초기화 실패:', error);
    }
  },
};
