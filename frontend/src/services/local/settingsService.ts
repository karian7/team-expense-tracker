import { db } from '../db/database';

const SETTINGS_KEYS = {
  INITIAL_BUDGET: 'initial_budget',
  DEFAULT_MONTHLY_BUDGET: 'default_monthly_budget',
  NEEDS_FULL_SYNC: 'needsFullSync',
} as const;

export const settingsService = {
  async getSetting(key: string): Promise<string | null> {
    const setting = await db.settings.get(key);
    return setting?.value || null;
  },

  async setSetting(key: string, value: string): Promise<void> {
    await db.settings.put({ key, value });
  },

  async getInitialBudget(): Promise<number> {
    const value = await this.getSetting(SETTINGS_KEYS.INITIAL_BUDGET);
    return value ? parseInt(value, 10) : 0;
  },

  async setInitialBudget(amount: number): Promise<void> {
    await this.setSetting(SETTINGS_KEYS.INITIAL_BUDGET, amount.toString());
  },

  async setDefaultMonthlyBudget(amount: number): Promise<void> {
    await this.setSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET, amount.toString());
  },

  async setNeedsFullSync(needsSync: boolean): Promise<void> {
    await this.setSetting(SETTINGS_KEYS.NEEDS_FULL_SYNC, needsSync.toString());
  },

  async resetAll(): Promise<void> {
    await db.budgetEvents.clear();
    await db.settings.clear();
    await db.syncMetadata.clear();
  },
};
