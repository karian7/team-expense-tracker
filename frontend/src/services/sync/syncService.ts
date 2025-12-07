import { eventService } from '../local/eventService';
import { eventApi, settingsApi } from '../api';
import { pendingEventService } from '../local/pendingEventService';
import { settingsService } from '../local/settingsService';

async function pushPendingEvents(): Promise<number> {
  const pendingEvents = await pendingEventService.getAll();

  if (pendingEvents.length === 0) {
    return 0;
  }

  let pushed = 0;

  for (const pending of pendingEvents) {
    try {
      await pendingEventService.updateStatus(pending.id, 'syncing');
      await eventService.markEventSyncState(pending.tempSequence, 'pending');

      const createdEvent = await eventApi.createEvent(pending.payload);

      await eventService.removeEvent(pending.tempSequence);
      await eventService.saveEvent(createdEvent);
      await pendingEventService.remove(pending.id);

      pushed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await pendingEventService.updateStatus(pending.id, 'failed', message);
      await eventService.markEventSyncState(pending.tempSequence, 'failed');
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
        await settingsService.resetAll();
        await pendingEventService.clearAll();

        try {
          const latestSettings = await settingsApi.get();
          await settingsService.setDefaultMonthlyBudget(latestSettings.defaultMonthlyBudget);
          await settingsService.setInitialBudget(latestSettings.initialBudget);
        } catch (settingsError) {
          console.error('Failed to refresh settings after reset', settingsError);
        }
      }

      await eventService.saveEvents(events);
      await eventService.updateLastSequence(serverSequence);

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
