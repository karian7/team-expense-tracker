import { db, type Settings, now } from '../db/database';

export interface AppSettings {
  defaultMonthlyBudget: number;
  initialBudget: number;
}

const SETTINGS_KEYS = {
  DEFAULT_MONTHLY_BUDGET: 'default_monthly_budget',
  INITIAL_BUDGET: 'initial_budget',
};

/**
 * 설정 값 가져오기
 */
async function getSetting(key: string): Promise<string | null> {
  const setting = await db.settings.get(key);
  return setting?.value || null;
}

/**
 * 설정 값 저장 또는 업데이트
 */
async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.get(key);

  if (existing) {
    // 업데이트
    await db.settings.update(key, {
      value,
      updatedAt: now(),
      version: existing.version + 1,
    });
  } else {
    // 생성
    const timestamp = now();
    const newSetting: Settings = {
      key,
      value,
      updatedAt: timestamp,
      version: 1,
      deleted: false,
    };
    await db.settings.add(newSetting);
  }
}

/**
 * 앱 설정 전체 가져오기
 */
async function getAppSettings(): Promise<AppSettings> {
  const defaultBudgetStr = await getSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET);
  const initialBudgetStr = await getSetting(SETTINGS_KEYS.INITIAL_BUDGET);

  return {
    defaultMonthlyBudget: defaultBudgetStr ? parseFloat(defaultBudgetStr) : 0,
    initialBudget: initialBudgetStr ? parseFloat(initialBudgetStr) : 0,
  };
}

/**
 * 기본 월별 예산 설정
 */
async function setDefaultMonthlyBudget(amount: number): Promise<void> {
  await setSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET, amount.toString());
}

/**
 * 기본 월별 예산 가져오기
 */
async function getDefaultMonthlyBudget(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET);
  return value ? parseFloat(value) : 0;
}

/**
 * 초기 예산 설정 (전체 데이터 리셋)
 * ⚠️ 모든 사용 내역과 월별 예산이 삭제됩니다!
 */
async function setInitialBudget(amount: number): Promise<void> {
  // 트랜잭션으로 모든 작업 수행
  await db.transaction('rw', db.expenses, db.monthlyBudgets, db.settings, async () => {
    // 모든 데이터 삭제 (hard delete)
    await db.expenses.clear();
    await db.monthlyBudgets.clear();

    // 설정 업데이트
    await setSetting(SETTINGS_KEYS.INITIAL_BUDGET, amount.toString());
    await setSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET, amount.toString());
  });
}

export const settingsService = {
  getSetting,
  setSetting,
  getAppSettings,
  setDefaultMonthlyBudget,
  getDefaultMonthlyBudget,
  setInitialBudget,
};
