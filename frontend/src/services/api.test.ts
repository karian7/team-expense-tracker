import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, eventApi, settingsApi } from './api';

describe('API Client', () => {
  let mock: InstanceType<typeof MockAdapter>;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });

  afterEach(() => {
    mock.reset();
    mock.restore();
  });

  describe('eventApi.sync', () => {
    it('should pass since parameter', async () => {
      mock.onGet('/events/sync?since=100').reply(200, {
        data: {
          lastSequence: 105,
          events: [],
          needsFullSync: false,
        },
      });

      const result = await eventApi.sync(100);

      expect(result.lastSequence).toBe(105);
      expect(mock.history.get[0].url).toBe('/events/sync?since=100');
    });

    it('should have 5 second timeout', () => {
      expect(apiClient.defaults.timeout).toBe(5000);
    });

    it('should return needsFullSync flag', async () => {
      mock.onGet('/events/sync?since=0').reply(200, {
        data: {
          lastSequence: 0,
          events: [],
          needsFullSync: true,
        },
      });

      const result = await eventApi.sync(0);

      expect(result.needsFullSync).toBe(true);
    });
  });

  describe('eventApi.createEvent', () => {
    it('should create event successfully', async () => {
      const eventPayload = {
        eventType: 'EXPENSE' as const,
        eventDate: '2025-01-15T12:00:00.000Z',
        year: 2025,
        month: 1,
        authorName: '홍길동',
        amount: 50000,
        storeName: '맛있는 식당',
      };

      mock.onPost('/events').reply(200, {
        data: {
          sequence: 1,
          ...eventPayload,
          createdAt: '2025-01-15T12:00:00.000Z',
        },
      });

      const result = await eventApi.createEvent(eventPayload);

      expect(result.sequence).toBe(1);
      expect(result.amount).toBe(50000);
    });

    it('should handle server error', async () => {
      mock.onPost('/events').reply(500, {
        error: 'Internal Server Error',
      });

      await expect(
        eventApi.createEvent({
          eventType: 'EXPENSE',
          eventDate: '2025-01-15T12:00:00.000Z',
          year: 2025,
          month: 1,
          authorName: '홍길동',
          amount: 50000,
        })
      ).rejects.toThrow();
    });
  });

  describe('settingsApi.get', () => {
    it('should get app settings', async () => {
      mock.onGet('/settings').reply(200, {
        data: {
          defaultMonthlyBudget: 300000,
          initialBudget: 500000,
          needsFullSync: false,
        },
      });

      const result = await settingsApi.get();

      expect(result.defaultMonthlyBudget).toBe(300000);
      expect(result.initialBudget).toBe(500000);
      expect(result.needsFullSync).toBe(false);
    });
  });

  describe('settingsApi.setInitialBudget', () => {
    it('should set initial budget', async () => {
      mock.onPost('/settings/initial-budget').reply(200, {
        data: {
          defaultMonthlyBudget: 300000,
          initialBudget: 300000,
          needsFullSync: false,
        },
      });

      const result = await settingsApi.setInitialBudget(300000);

      expect(result.initialBudget).toBe(300000);
      expect(mock.history.post[0].data).toBe(JSON.stringify({ initialBudget: 300000 }));
    });
  });

  describe('settingsApi.getDefaultMonthlyBudget', () => {
    it('should return default monthly budget', async () => {
      mock.onGet('/settings').reply(200, {
        data: {
          defaultMonthlyBudget: 300000,
          initialBudget: 500000,
          needsFullSync: false,
        },
      });

      const result = await settingsApi.getDefaultMonthlyBudget();

      expect(result).toBe(300000);
    });

    it('should return 0 when not set', async () => {
      mock.onGet('/settings').reply(200, {
        data: {
          defaultMonthlyBudget: null,
          initialBudget: null,
          needsFullSync: false,
        },
      });

      const result = await settingsApi.getDefaultMonthlyBudget();

      expect(result).toBe(0);
    });
  });
});
