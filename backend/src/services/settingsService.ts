import prisma from '../utils/prisma';

export interface AppSettings {
  defaultMonthlyBudget: number;
  initialBudget: number;
  needsFullSync: boolean;
}

const SETTINGS_KEYS = {
  DEFAULT_MONTHLY_BUDGET: 'default_monthly_budget',
  INITIAL_BUDGET: 'initial_budget',
  NEEDS_FULL_SYNC: 'needsFullSync',
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
  const needsFullSyncStr = await getSetting(SETTINGS_KEYS.NEEDS_FULL_SYNC);

  return {
    defaultMonthlyBudget: defaultBudgetStr ? parseFloat(defaultBudgetStr) : 0,
    initialBudget: initialBudgetStr ? parseFloat(initialBudgetStr) : 0,
    needsFullSync: needsFullSyncStr === 'true',
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
 * 초기 예산 설정 (Settings만 저장)
 * ⚠️ BUDGET_RESET 이벤트는 클라이언트가 로컬에서 생성 후 서버로 전송합니다 (로컬 퍼스트).
 */
export async function setInitialBudget(amount: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
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
 * Full Sync 필요 플래그 설정
 */
export async function setNeedsFullSync(needsSync: boolean): Promise<void> {
  await setSetting(
    SETTINGS_KEYS.NEEDS_FULL_SYNC,
    needsSync.toString(),
    '서버 DB 리셋 후 Full Sync 필요 여부'
  );
}
