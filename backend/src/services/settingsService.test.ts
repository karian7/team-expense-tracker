import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '../test/setup';
import { getAppSettings, setInitialBudget, getSetting, setSetting } from './settingsService';

// Helper to create settings mock
const createSettingsMock = (key: string, value: string, description: string | null = null) => ({
  id: `test-id-${key}`,
  key,
  value,
  description,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
});

describe('settingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSetting', () => {
    it('should return value when setting exists', async () => {
      prismaMock.settings.findUnique.mockResolvedValue(
        createSettingsMock('test_key', 'test_value')
      );

      const result = await getSetting('test_key');

      expect(result).toBe('test_value');
    });

    it('should return null when setting does not exist', async () => {
      prismaMock.settings.findUnique.mockResolvedValue(null);

      const result = await getSetting('nonexistent_key');

      expect(result).toBeNull();
    });
  });

  describe('setSetting', () => {
    it('should upsert setting value', async () => {
      prismaMock.settings.upsert.mockResolvedValue(
        createSettingsMock('test_key', 'test_value', 'Test description')
      );

      await setSetting('test_key', 'test_value', 'Test description');

      expect(prismaMock.settings.upsert).toHaveBeenCalledWith({
        where: { key: 'test_key' },
        create: {
          key: 'test_key',
          value: 'test_value',
          description: 'Test description',
        },
        update: {
          value: 'test_value',
          description: 'Test description',
        },
      });
    });
  });

  describe('getAppSettings', () => {
    it('should return default values when no settings exist', async () => {
      prismaMock.settings.findUnique.mockResolvedValue(null);
      prismaMock.budgetEvent.count.mockResolvedValue(0);

      const result = await getAppSettings();

      expect(result.defaultMonthlyBudget).toBe(0);
      expect(result.initialBudget).toBe(0);
      expect(result.needsFullSync).toBe(false);
    });

    it('should return saved settings', async () => {
      prismaMock.settings.findUnique
        .mockResolvedValueOnce(createSettingsMock('default_monthly_budget', '300000'))
        .mockResolvedValueOnce(createSettingsMock('initial_budget', '500000'))
        .mockResolvedValueOnce(createSettingsMock('needsFullSync', 'false'));
      prismaMock.budgetEvent.count.mockResolvedValue(5);

      const result = await getAppSettings();

      expect(result.defaultMonthlyBudget).toBe(300000);
      expect(result.initialBudget).toBe(500000);
      expect(result.needsFullSync).toBe(false);
    });

    it('should auto-reset needsFullSync when events exist', async () => {
      prismaMock.settings.findUnique
        .mockResolvedValueOnce(createSettingsMock('default_monthly_budget', '300000'))
        .mockResolvedValueOnce(createSettingsMock('initial_budget', '500000'))
        .mockResolvedValueOnce(createSettingsMock('needsFullSync', 'true'));
      prismaMock.budgetEvent.count.mockResolvedValue(5);
      prismaMock.settings.upsert.mockResolvedValue(
        createSettingsMock('needsFullSync', 'false')
      );

      const result = await getAppSettings();

      expect(result.needsFullSync).toBe(false);
      expect(prismaMock.settings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'needsFullSync' },
          update: expect.objectContaining({ value: 'false' }),
        })
      );
    });
  });

  describe('setInitialBudget', () => {
    it('should use transaction to set both initial and default budget', async () => {
      const mockTransaction = vi.fn().mockImplementation(async (callback) => {
        const tx = {
          settings: {
            upsert: vi.fn().mockResolvedValue(
              createSettingsMock('test', '300000')
            ),
          },
        };
        return callback(tx);
      });

      prismaMock.$transaction.mockImplementation(mockTransaction);

      await setInitialBudget(300000);

      expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    });
  });
});