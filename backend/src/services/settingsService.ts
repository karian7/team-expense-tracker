import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../utils/prisma';

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
  const initialBudgetStr = await getSetting(SETTINGS_KEYS.INITIAL_BUDGET);

  return {
    defaultMonthlyBudget: defaultBudgetStr ? parseFloat(defaultBudgetStr) : 0,
    initialBudget: initialBudgetStr ? parseFloat(initialBudgetStr) : 0,
  };
}

/**
 * 기본 월별 예산 설정 (다음 달부터 적용)
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

/**
 * 초기 예산 설정 (이벤트 기반 리셋)
 * ⚠️ BUDGET_RESET 이벤트 이후의 내역만 유효하게 됩니다.
 */
export async function setInitialBudget(amount: number): Promise<void> {
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      await tx.budgetEvent.create({
        data: {
          eventType: 'BUDGET_RESET',
          eventDate: now,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          authorName: 'SYSTEM',
          amount: new Decimal(0),
          description: `데이터 초기화 (${now.toISOString()})`,
        },
      });

      await tx.settings.upsert({
        where: { key: SETTINGS_KEYS.INITIAL_BUDGET },
        create: {
          key: SETTINGS_KEYS.INITIAL_BUDGET,
          value: amount.toString(),
          description: '초기 설정된 회식비 예산',
        },
        update: {
          value: amount.toString(),
          description: '초기 설정된 회식비 예산',
        },
      });

      await tx.settings.upsert({
        where: { key: SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET },
        create: {
          key: SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET,
          value: amount.toString(),
          description: '매월 자동 생성되는 기본 회식비 금액',
        },
        update: {
          value: amount.toString(),
          description: '매월 자동 생성되는 기본 회식비 금액',
        },
      });
    },
    { timeout: 15000 }
  );
}

/**
 * 전체 데이터 초기화 (이벤트 소싱 원칙 준수)
 * ✅ 기존 이벤트를 삭제하지 않고 BUDGET_RESET 이벤트를 추가합니다.
 * ✅ BUDGET_RESET 이후의 이벤트만 유효하게 됩니다.
 * ✅ Sequence는 계속 증가하며, 이벤트 히스토리가 보존됩니다.
 */
export async function resetAllData(): Promise<void> {
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      // ✅ BUDGET_RESET 이벤트 추가 (삭제 X)
      await tx.budgetEvent.create({
        data: {
          eventType: 'BUDGET_RESET',
          eventDate: now,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          authorName: 'SYSTEM',
          amount: new Decimal(0),
          description: `전체 데이터 리셋 (${now.toISOString()})`,
        },
      });

      // Settings는 삭제 (이벤트가 아니므로)
      await tx.settings.deleteMany({});
    },
    { timeout: 15000 }
  );
}
