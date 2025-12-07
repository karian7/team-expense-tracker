import { useLiveQuery } from 'dexie-react-hooks';
import { settingsService, type AppSettings } from '../services/local/settingsService';

export function useSettings() {
  return useLiveQuery(() => settingsService.getAppSettings());
}

export function useUpdateSettings() {
  return {
    mutateAsync: async (settings: Partial<AppSettings>) => {
      if (settings.defaultMonthlyBudget !== undefined) {
        await settingsService.setDefaultMonthlyBudget(settings.defaultMonthlyBudget);
      }
      return settingsService.getAppSettings();
    },
    mutate: (settings: Partial<AppSettings>) => {
      if (settings.defaultMonthlyBudget !== undefined) {
        settingsService.setDefaultMonthlyBudget(settings.defaultMonthlyBudget);
      }
    },
  };
}

export function useSetInitialBudget() {
  return {
    mutateAsync: async (initialBudget: number) => {
      await settingsService.setInitialBudget(initialBudget);
      return settingsService.getAppSettings();
    },
    mutate: (initialBudget: number) => {
      settingsService.setInitialBudget(initialBudget);
    },
  };
}
