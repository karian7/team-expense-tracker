import { eventService } from '../local/eventService';
import { eventApi } from '../api';

export const syncService = {
  async sync(): Promise<{ newEvents: number; lastSequence: number }> {
    try {
      const lastSequence = await eventService.getLatestSequence();
      const { events, lastSequence: serverSequence } = await eventApi.sync(lastSequence);

      if (events.length === 0) {
        return { newEvents: 0, lastSequence };
      }

      await eventService.saveEvents(events);
      await eventService.updateLastSequence(serverSequence);

      console.log(`Synced ${events.length} new events`);
      return { newEvents: events.length, lastSequence: serverSequence };
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
