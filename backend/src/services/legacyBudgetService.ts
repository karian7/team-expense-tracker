import { getCurrentYearMonth } from '../utils/date';
import { MonthlyBudgetResponse } from '../types';
import { getDefaultMonthlyBudget } from './settingsService';
import { getEventsByMonth, createBudgetEvent, calculateMonthlyBudget } from './budgetEventService';

/**
 * 월별 예산 조회 또는 생성 (레거시 호환, 복식부기)
 *
 * 이월은 이벤트가 아니라 계산으로만 처리됨
 * Race Condition 방지: Unique constraint + 재조회
 */
export async function getOrCreateMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudgetResponse> {
  const events = await getEventsByMonth(year, month);

  // 이미 이벤트가 있으면 계산해서 반환
  if (events.length > 0) {
    return calculateMonthlyBudget(year, month);
  }

  // 없으면 BUDGET_IN 이벤트 생성 시도
  const defaultBudget = await getDefaultMonthlyBudget();

  try {
    await createBudgetEvent({
      eventType: 'BUDGET_IN',
      eventDate: new Date(year, month - 1, 1).toISOString(),
      year,
      month,
      authorName: 'SYSTEM',
      amount: defaultBudget,
      description: '기본 월별 예산',
    });
  } catch {
    // Unique constraint 위반 = 다른 요청이 먼저 생성함
    // 에러 무시하고 재조회
    console.log(`Budget for ${year}-${month} already created by another request`);
  }

  // 항상 재조회해서 최신 상태 반환
  return calculateMonthlyBudget(year, month);
}

/**
 * 현재 월의 예산 조회
 */
export async function getCurrentMonthlyBudget(): Promise<MonthlyBudgetResponse> {
  const { year, month } = getCurrentYearMonth();
  return getOrCreateMonthlyBudget(year, month);
}

/**
 * 월별 예산의 기본 금액 설정 (복식부기)
 */
export async function updateMonthlyBudgetBaseAmount(
  year: number,
  month: number,
  baseAmount: number
): Promise<MonthlyBudgetResponse> {
  const currentBudget = await getOrCreateMonthlyBudget(year, month);
  const adjustment = baseAmount - currentBudget.budgetIn;

  if (adjustment !== 0) {
    const eventType = adjustment > 0 ? 'BUDGET_ADJUSTMENT_INCREASE' : 'BUDGET_ADJUSTMENT_DECREASE';

    await createBudgetEvent({
      eventType,
      eventDate: new Date(year, month - 1, 1).toISOString(),
      year,
      month,
      authorName: 'SYSTEM',
      amount: Math.abs(adjustment),
      description:
        adjustment > 0
          ? `예산 추가: ${adjustment.toLocaleString()}원`
          : `예산 감소: ${Math.abs(adjustment).toLocaleString()}원`,
    });
  }

  return calculateMonthlyBudget(year, month);
}

/**
 * 현재 월 예산 잔액을 특정 금액으로 조정 (복식부기)
 */
export async function adjustCurrentMonthBudget(
  targetBalance: number,
  description: string
): Promise<MonthlyBudgetResponse> {
  const { year, month } = getCurrentYearMonth();
  const budget = await getOrCreateMonthlyBudget(year, month);

  const currentBalance = budget.balance;
  const adjustmentAmount = targetBalance - currentBalance;

  if (adjustmentAmount === 0) {
    throw new Error('조정할 금액이 없습니다.');
  }

  const adjustmentEventType =
    adjustmentAmount > 0 ? 'BUDGET_ADJUSTMENT_INCREASE' : 'BUDGET_ADJUSTMENT_DECREASE';

  try {
    await createBudgetEvent({
      eventType: adjustmentEventType,
      eventDate: new Date().toISOString(),
      year,
      month,
      authorName: 'SYSTEM',
      amount: Math.abs(adjustmentAmount),
      description:
        description ||
        `예산 조정 (${adjustmentAmount > 0 ? '+' : '-'}${Math.abs(adjustmentAmount).toLocaleString()}원)`,
    });
  } catch (error) {
    // Prisma Unique Constraint 에러 확인
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new Error(
        `이미 "${description}"라는 내용으로 조정한 기록이 있습니다. 다른 내용으로 입력해주세요.`
      );
    }
    throw error;
  }

  return calculateMonthlyBudget(year, month);
}
