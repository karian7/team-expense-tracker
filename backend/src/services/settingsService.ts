import prisma from '../utils/prisma';

export interface AppSettings {
  defaultMonthlyBudget: number;
}

const SETTINGS_KEYS = {
  DEFAULT_MONTHLY_BUDGET: 'default_monthly_budget',
};

/**
 * 설정 값 가져오기
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.settings.findUnique({
    where: { key },
  });

  return setting?.value || null;
}

/**
 * 설정 값 저장 또는 업데이트
 */
export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    create: {
      key,
      value,
      description,
    },
    update: {
      value,
      description,
    },
  });
}

/**
 * 앱 설정 전체 가져오기
 */
export async function getAppSettings(): Promise<AppSettings> {
  const defaultBudgetStr = await getSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET);

  return {
    defaultMonthlyBudget: defaultBudgetStr ? parseFloat(defaultBudgetStr) : 0,
  };
}

/**
 * 기본 월별 예산 설정
 */
export async function setDefaultMonthlyBudget(amount: number): Promise<void> {
  await setSetting(
    SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET,
    amount.toString(),
    '매월 자동 생성되는 기본 회식비 금액'
  );
}

/**
 * 기본 월별 예산 가져오기
 */
export async function getDefaultMonthlyBudget(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET);
  return value ? parseFloat(value) : 0;
}
