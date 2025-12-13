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

      if (hasResetEvent) {
        // ✅ 이벤트 소싱 원칙: budgetEvents는 삭제하지 않음!

        // 가장 최근의 BUDGET_RESET 이벤트 찾기
        const resetEvents = events.filter((e) => e.eventType === 'BUDGET_RESET');
        const latestResetEvent = resetEvents[resetEvents.length - 1];
        const resetEventDate = new Date(latestResetEvent.eventDate);

        // ✅ 시간 비교: 리셋 이전 pending만 삭제, 리셋 이후 pending은 유지
        const allPending = await pendingEventService.getAll();
        let removedCount = 0;
        let keptCount = 0;

        for (const pending of allPending) {
          const pendingCreatedAt = new Date(pending.createdAt);

          if (pendingCreatedAt <= resetEventDate) {
            // 리셋 이전에 생성된 pending → 삭제
            await pendingEventService.remove(pending.id);
            await eventService.removeEvent(pending.tempSequence);
            removedCount++;
          } else {
            // 리셋 이후에 생성된 pending → 유지 (여전히 유효함)
            keptCount++;
          }
        }

        // 서버 설정 동기화
        try {
          const latestSettings = await settingsApi.get();
          await settingsService.setDefaultMonthlyBudget(latestSettings.defaultMonthlyBudget);
          await settingsService.setInitialBudget(latestSettings.initialBudget);
        } catch (settingsError) {
          console.error('Failed to refresh settings after reset', settingsError);
        }

        console.log(
          `[Sync] BUDGET_RESET detected (${resetEventDate.toISOString()}), removed ${removedCount} old pending events, kept ${keptCount} new pending events`
        );
      }

      // ✅ 모든 서버 이벤트 저장 (BUDGET_RESET 이전 데이터 포함)
      // calculateMonthlyBudget()이 자동으로 BUDGET_RESET 이후만 계산
      await eventService.saveEvents(events);
      await eventService.updateLastSequence(serverSequence);

      // ✅ 로컬 퍼스트 원칙: 남은 pending 이벤트의 sequence 재할당
      // 서버 최신 sequence 다음으로 정렬하여 로컬 DB에 반영
      const remainingPending = await pendingEventService.getAll();

      if (remainingPending.length > 0) {
        for (let i = 0; i < remainingPending.length; i++) {
          const pending = remainingPending[i];
          const newSequence = serverSequence + 1 + i;

          // Dexie 트랜잭션: budgetEvents와 pendingEvents 원자적 업데이트
          await db.transaction('rw', db.budgetEvents, db.pendingEvents, async () => {
            // 1. 기존 tempSequence 이벤트 삭제
            await db.budgetEvents.delete(pending.tempSequence);

            // 2. 새 sequence로 이벤트 생성 (서버 sequence 다음)
            const updatedEvent = {
              sequence: newSequence,
              eventType: pending.payload.eventType,
              eventDate: pending.payload.eventDate,
              year: pending.payload.year,
              month: pending.payload.month,
              authorName: pending.payload.authorName,
              amount: pending.payload.amount,
              storeName: pending.payload.storeName ?? null,
              description: pending.payload.description ?? null,
              receiptImage: pending.payload.receiptImage ?? null,
              ocrRawData: pending.payload.ocrRawData
                ? JSON.stringify(pending.payload.ocrRawData)
                : null,
              referenceSequence: pending.payload.referenceSequence ?? null,
              createdAt: new Date().toISOString(),
              isLocalOnly: true,
              syncState: pending.status,
              pendingId: pending.id,
            };
            await db.budgetEvents.put(updatedEvent);

            // 3. pending의 tempSequence 업데이트
            await db.pendingEvents.update(pending.id, {
              tempSequence: newSequence,
            });
          });
        }

        console.log(
          `[Sync] Reassigned ${remainingPending.length} pending events to sequences ${serverSequence + 1}-${serverSequence + remainingPending.length}`
        );
      }

      console.log(`Synced ${events.length} new events`);
      return { newEvents: events.length, pushedEvents, lastSequence: serverSequence };
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
