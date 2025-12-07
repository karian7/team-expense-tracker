import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { BUDGET_EVENT_CONSTANTS } from '../constants/budgetEvents';

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
 * 현재 월에 기본 예산 반영 보장
 * 조건:
 * 1. defaultMonthlyBudget > 0
 * 2. 이번 달에 "기본 월별 예산" 이벤트가 없음
 * → 이벤트 생성 (Unique Constraint로 중복 방지)
 */
export async function ensureCurrentMonthBudget(): Promise<{
  created: boolean;
  message: string;
}> {
  const defaultBudget = await getDefaultMonthlyBudget();

  if (defaultBudget <= 0) {
    return { created: false, message: 'Default monthly budget is not set' };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // "기본 월별 예산" 이벤트가 이미 있는지 확인
  const existingEvent = await prisma.budgetEvent.findFirst({
    where: {
      year,
      month,
      eventType: 'BUDGET_IN',
      authorName: BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
      description: BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION,
    },
  });

  if (existingEvent) {
    return { created: false, message: 'Monthly budget already reflected' };
  }

  // 이벤트 생성 (Unique Constraint로 중복 방지)
  try {
    await prisma.budgetEvent.create({
      data: {
        eventType: 'BUDGET_IN',
        eventDate: new Date(year, month - 1, 1),
        year,
        month,
        authorName: BUDGET_EVENT_CONSTANTS.SYSTEM_AUTHOR,
        amount: new Decimal(defaultBudget),
        description: BUDGET_EVENT_CONSTANTS.MONTHLY_BUDGET_DESCRIPTION,
      },
    });

    return { created: true, message: 'Monthly budget reflected successfully' };
  } catch {
    // Unique Constraint 위반 = 이미 다른 요청이 생성함
    return { created: false, message: 'Monthly budget already reflected (race condition)' };
  }
}

/**
 * 기본 월별 예산 가져오기
 */
export async function getDefaultMonthlyBudget(): Promise<number> {
  const value = await getSetting(SETTINGS_KEYS.DEFAULT_MONTHLY_BUDGET);
  return value ? parseFloat(value) : 0;
}

/**
 * 초기 예산 설정 (전체 데이터 리셋)
 * ⚠️ 모든 사용 내역과 월별 예산이 삭제됩니다!
 */
export async function setInitialBudget(amount: number): Promise<void> {
  // 트랜잭션으로 모든 작업 수행
  await prisma.$transaction(
    async (tx) => {
      await tx.budgetEvent.deleteMany({});

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
