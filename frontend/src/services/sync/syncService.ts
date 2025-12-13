import { eventService } from '../local/eventService';
import { eventApi, settingsApi } from '../api';
import { pendingEventService } from '../local/pendingEventService';
import { settingsService } from '../local/settingsService';
import { db } from '../db/database';

async function pushPendingEvents(): Promise<number> {
  const pendingEvents = await pendingEventService.getAll();

  if (pendingEvents.length === 0) {
    return 0;
  }

  let pushed = 0;

  for (const pending of pendingEvents) {
    // 재시도 횟수 제한 (5회)
    if ((pending.retryCount || 0) >= 5) {
      console.error(`[Sync] Max retries exceeded for pending event ${pending.id}`);
      continue; // 건너뛰고 다음 이벤트 처리
    }

    // 지수 백오프 (Exponential Backoff)
    const backoffMs = Math.min(1000 * Math.pow(2, pending.retryCount || 0), 30000);
    const timeSinceLastAttempt = pending.lastSyncAttempt
      ? Date.now() - new Date(pending.lastSyncAttempt).getTime()
      : Infinity;

    if (timeSinceLastAttempt < backoffMs) {
      console.log(`[Sync] Backoff not expired for ${pending.id}, skipping`);
      continue; // 백오프 기간 미경과 시 건너뜀
    }

    try {
      await pendingEventService.updateStatus(pending.id, 'syncing');
      await eventService.markEventSyncState(pending.tempSequence, 'pending');

      // 서버 전송 (가장 위험한 작업)
      const createdEvent = await eventApi.createEvent(pending.payload);

      // Dexie 트랜잭션으로 3단계 원자적 처리
      await db.transaction('rw', db.budgetEvents, db.pendingEvents, async () => {
        // 1. 임시 이벤트 삭제
        await db.budgetEvents.delete(pending.tempSequence);

        // 2. 서버 이벤트 저장
        await db.budgetEvents.put(createdEvent);

        // 3. 대기 큐에서 제거
        await db.pendingEvents.delete(pending.id);
      });

      pushed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // 재시도 카운터 증가
      const retryCount = (pending.retryCount || 0) + 1;

      await pendingEventService.updateStatus(pending.id, 'failed', message);
      await eventService.markEventSyncState(pending.tempSequence, 'failed');

      // 재시도 메타데이터 업데이트
      await db.pendingEvents.update(pending.id, {
        retryCount,
        lastSyncAttempt: new Date().toISOString(),
      });

      throw error;
    }
  }

  return pushed;
}

export const syncService = {
  async sync(): Promise<{ newEvents: number; pushedEvents: number; lastSequence: number }> {
    try {
      const pushedEvents = await pushPendingEvents();
      const lastSequence = await eventService.getLatestSequence();
      const { events, lastSequence: serverSequence } = await eventApi.sync(lastSequence);

      if (events.length === 0) {
        return { newEvents: 0, pushedEvents, lastSequence };
      }

      const hasResetEvent = events.some((event) => event.eventType === 'BUDGET_RESET');
      let eventsToSave = events;

      if (hasResetEvent) {
        // 로컬 DB 초기화
        await settingsService.resetAll();
        await pendingEventService.clearAll();

        // 서버 설정 동기화
        try {
          const latestSettings = await settingsApi.get();
          await settingsService.setDefaultMonthlyBudget(latestSettings.defaultMonthlyBudget);
          await settingsService.setInitialBudget(latestSettings.initialBudget);
        } catch (settingsError) {
          console.error('Failed to refresh settings after reset', settingsError);
        }

        // 🔧 수정: 가장 최근의 BUDGET_RESET 이벤트와 그 이후의 이벤트만 저장
        const resetEvents = events.filter((e) => e.eventType === 'BUDGET_RESET');
        const latestResetEvent = resetEvents[resetEvents.length - 1];

        if (latestResetEvent) {
          eventsToSave = events.filter((e) => e.sequence >= latestResetEvent.sequence);
          console.log(
            `[Sync] BUDGET_RESET detected (sequence: ${latestResetEvent.sequence}), filtering ${events.length - eventsToSave.length} old events`
          );
        }
      }

      await eventService.saveEvents(eventsToSave);
      await eventService.updateLastSequence(serverSequence);

      console.log(`Synced ${eventsToSave.length} new events`);
      return { newEvents: eventsToSave.length, pushedEvents, lastSequence: serverSequence };
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  },

  startAutoSync(intervalMs: number = 30000): ReturnType<typeof setInterval> {
    return setInterval(() => {
      this.sync().catch(console.error);
    }, intervalMs);
  },

  stopAutoSync(timerId: ReturnType<typeof setInterval>): void {
    clearInterval(timerId);
  },
};
