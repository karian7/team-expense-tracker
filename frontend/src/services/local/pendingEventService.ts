import { db, type PendingEvent } from '../db/database';
import type { CreateBudgetEventPayload } from '../../types';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const pendingEventService = {
  async enqueue(payload: CreateBudgetEventPayload, tempSequence: number): Promise<PendingEvent> {
    const timestamp = new Date().toISOString();
    const pendingEvent: PendingEvent = {
      id: generateId(),
      tempSequence,
      payload,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db.pendingEvents.put(pendingEvent);
    return pendingEvent;
  },

  async getAll(): Promise<PendingEvent[]> {
    const pending = await db.pendingEvents.orderBy('createdAt').toArray();

    return pending.sort((a, b) => {
      const createdDiff = a.createdAt.localeCompare(b.createdAt);
      if (createdDiff !== 0) {
        return createdDiff;
      }

      if (a.tempSequence !== b.tempSequence) {
        return b.tempSequence - a.tempSequence;
      }

      return a.id.localeCompare(b.id);
    });
  },

  async updateStatus(
    id: string,
    status: PendingEvent['status'],
    errorMessage?: string
  ): Promise<void> {
    await db.pendingEvents.update(id, {
      status,
      updatedAt: new Date().toISOString(),
      lastError: errorMessage,
    });
  },

  async remove(id: string): Promise<void> {
    await db.pendingEvents.delete(id);
  },
};
