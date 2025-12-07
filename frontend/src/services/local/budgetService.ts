import { db, type MonthlyBudget, now, generateId } from '../db/database';
import { settingsService } from './settingsService';
import { syncQueue } from '../sync/syncQueue';

/**
 * 이전 월 계산 유틸리티
 */
function getPreviousYearMonth(year: number, month: number) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

/**
 * 현재 년/월 가져오기
 */
function getCurrentYearMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // 0-based → 1-based
  };
}

/**
 * 월별 예산 조회 또는 생성
 * 해당 월이 없으면 자동으로 생성하고 이전 달 잔액을 이월
 */
export async function getOrCreateMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudget> {
  // 기존 예산 조회
  let budget = await db.monthlyBudgets
    .where('[year+month]')
    .equals([year, month])
    .and((b) => !b.deleted)
    .first();

  // 없으면 생성
  if (!budget) {
    const previousMonth = getPreviousYearMonth(year, month);
    const previousBudget = await db.monthlyBudgets
      .where('[year+month]')
      .equals([previousMonth.year, previousMonth.month])
      .and((b) => !b.deleted)
      .first();

    // 이전 달 잔액 가져오기 (없으면 0)
    const carriedAmount = previousBudget?.balance || 0;

    // Settings에서 기본 월별 예산 가져오기
    const defaultBudget = await settingsService.getDefaultMonthlyBudget();
    const baseAmount = defaultBudget;

    const totalBudget = baseAmount + carriedAmount;

    const timestamp = now();
    budget = {
      id: generateId(),
      year,
      month,
      baseAmount,
      carriedAmount,
      totalBudget,
      totalSpent: 0,
      balance: totalBudget,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      deleted: false,
    };

    await db.monthlyBudgets.add(budget);

    // 동기화 큐에 추가
    await syncQueue.enqueue('budgets', 'create', budget.id, budget);
  }

  return budget;
}

/**
 * 현재 월의 예산 조회
 */
export async function getCurrentMonthlyBudget(): Promise<MonthlyBudget> {
  const { year, month } = getCurrentYearMonth();
  return getOrCreateMonthlyBudget(year, month);
}

/**
 * 월별 예산의 기본 금액 설정
 */
export async function updateMonthlyBudgetBaseAmount(
  year: number,
  month: number,
  baseAmount: number
): Promise<MonthlyBudget> {
  const budget = await getOrCreateMonthlyBudget(year, month);

  const newTotalBudget = baseAmount + budget.carriedAmount;
  const newBalance = newTotalBudget - budget.totalSpent;

  const updates = {
    baseAmount,
    totalBudget: newTotalBudget,
    balance: newBalance,
    updatedAt: now(),
    version: budget.version + 1,
  };

  await db.monthlyBudgets.update(budget.id, updates);

  // 동기화 큐에 추가
  const updatedBudget = { ...budget, ...updates };
  await syncQueue.enqueue('budgets', 'update', budget.id, updatedBudget);

  return updatedBudget;
}

/**
 * 월별 예산 재계산
 * Expense가 추가/수정/삭제될 때 호출됨
 */
export async function recalculateMonthlyBudget(monthlyBudgetId: string): Promise<MonthlyBudget> {
  const budget = await db.monthlyBudgets.get(monthlyBudgetId);

  if (!budget) {
    throw new Error('Monthly budget not found');
  }

  // 해당 예산의 모든 지출 조회 (삭제되지 않은 것만)
  const expenses = await db.expenses
    .where('monthlyBudgetId')
    .equals(monthlyBudgetId)
    .and((e) => !e.deleted)
    .toArray();

  // 총 사용액 계산
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // 잔액 계산
  const balance = budget.totalBudget - totalSpent;

  // 업데이트
  const updates = {
    totalSpent,
    balance,
    updatedAt: now(),
    version: budget.version + 1,
  };

  await db.monthlyBudgets.update(monthlyBudgetId, updates);

  return { ...budget, ...updates };
}

/**
 * 월 이월 처리
 * 새 달을 수동으로 생성하고 이전 달 잔액을 이월
 */
export async function rolloverMonth(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  newBaseAmount: number
): Promise<MonthlyBudget> {
  const fromBudget = await getOrCreateMonthlyBudget(fromYear, fromMonth);

  // 대상 월이 이미 존재하는지 확인
  const existingBudget = await db.monthlyBudgets
    .where('[year+month]')
    .equals([toYear, toMonth])
    .and((b) => !b.deleted)
    .first();

  if (existingBudget) {
    throw new Error('Target month budget already exists');
  }

  const carriedAmount = fromBudget.balance;
  const baseAmount = newBaseAmount;
  const totalBudget = baseAmount + carriedAmount;

  const timestamp = now();
  const newBudget: MonthlyBudget = {
    id: generateId(),
    year: toYear,
    month: toMonth,
    baseAmount,
    carriedAmount,
    totalBudget,
    totalSpent: 0,
    balance: totalBudget,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    deleted: false,
  };

  await db.monthlyBudgets.add(newBudget);

  // 동기화 큐에 추가
  await syncQueue.enqueue('budgets', 'create', newBudget.id, newBudget);

  return newBudget;
}

/**
 * 특정 월의 예산 조회 (생성하지 않음)
 */
export async function getMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudget | undefined> {
  return db.monthlyBudgets
    .where('[year+month]')
    .equals([year, month])
    .and((b) => !b.deleted)
    .first();
}

/**
 * 월별 예산 삭제 (soft delete)
 */
export async function deleteMonthlyBudget(id: string): Promise<void> {
  await db.monthlyBudgets.update(id, {
    deleted: true,
    updatedAt: now(),
  });

  // 동기화 큐에 추가
  const budget = await db.monthlyBudgets.get(id);
  if (budget) {
    await syncQueue.enqueue('budgets', 'delete', id, { ...budget, deleted: true });
  }
}

/**
 * 현재 월 예산 잔액을 특정 금액으로 조정
 */
export async function adjustCurrentBudget(
  targetBalance: number,
  description: string
): Promise<MonthlyBudget> {
  const { year, month } = getCurrentYearMonth();
  const budget = await getOrCreateMonthlyBudget(year, month);

  const currentBalance = budget.balance;
  const adjustmentAmount = targetBalance - currentBalance;

  if (adjustmentAmount === 0) {
    throw new Error('조정할 금액이 없습니다.');
  }

  // 예산 조정 내역을 Expense로 기록 (음수 금액 = 예산 추가)
  const timestamp = now();
  const expense = {
    id: generateId(),
    monthlyBudgetId: budget.id,
    authorName: 'SYSTEM',
    amount: -adjustmentAmount, // 음수로 저장하여 지출이 줄어드는 효과
    expenseDate: new Date().toISOString(),
    storeName: undefined,
    receiptImageUrl: undefined,
    description: description || '예산 조정',
    ocrRawData: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    deleted: false,
  };

  await db.expenses.add(expense);

  // 동기화 큐에 추가
  await syncQueue.enqueue('expenses', 'create', expense.id, expense);

  // 예산 재계산
  return recalculateMonthlyBudget(budget.id);
}

export const budgetService = {
  getOrCreateMonthlyBudget,
  getCurrentMonthlyBudget,
  updateMonthlyBudgetBaseAmount,
  recalculateMonthlyBudget,
  rolloverMonth,
  getMonthlyBudget,
  deleteMonthlyBudget,
  adjustCurrentBudget,
};
