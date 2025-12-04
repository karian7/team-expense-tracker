import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { getCurrentYearMonth, getPreviousYearMonth } from '../utils/date';
import { convertDecimalsToNumbers } from '../utils/decimal';
import {
  MonthlyBudgetResponse,
  MonthlyReportResponse,
  DailyBreakdown,
  AuthorBreakdown,
  ExpenseResponse,
} from '../types';
import { getDefaultMonthlyBudget } from './settingsService';

const toMonthlyBudgetResponse = (budget: unknown): MonthlyBudgetResponse =>
  convertDecimalsToNumbers(
    budget as unknown as Record<string, unknown>
  ) as unknown as MonthlyBudgetResponse;

/**
 * 월별 예산 조회 또는 생성
 * 해당 월이 없으면 자동으로 생성하고 이전 달 잔액을 이월
 */
export async function getOrCreateMonthlyBudget(
  year: number,
  month: number
): Promise<MonthlyBudgetResponse> {
  // 기존 예산 조회
  let budget = await prisma.monthlyBudget.findUnique({
    where: {
      year_month: { year, month },
    },
  });

  // 없으면 생성
  if (!budget) {
    const previousMonth = getPreviousYearMonth(year, month);
    const previousBudget = await prisma.monthlyBudget.findUnique({
      where: {
        year_month: { year: previousMonth.year, month: previousMonth.month },
      },
    });

    // 이전 달 잔액 가져오기 (없으면 0)
    const carriedAmount = previousBudget?.balance || new Decimal(0);

    // Settings에서 기본 월별 예산 가져오기
    const defaultBudget = await getDefaultMonthlyBudget();
    const baseAmount = new Decimal(defaultBudget);

    const totalBudget = baseAmount.plus(carriedAmount);

    budget = await prisma.monthlyBudget.create({
      data: {
        year,
        month,
        baseAmount,
        carriedAmount,
        totalBudget,
        totalSpent: new Decimal(0),
        balance: totalBudget,
      },
    });
  }

  return toMonthlyBudgetResponse(budget);
}

/**
 * 현재 월의 예산 조회
 */
export async function getCurrentMonthlyBudget(): Promise<MonthlyBudgetResponse> {
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
): Promise<MonthlyBudgetResponse> {
  const budget = await getOrCreateMonthlyBudget(year, month);

  const newBaseAmount = new Decimal(baseAmount);
  const newTotalBudget = newBaseAmount.plus(budget.carriedAmount);
  const newBalance = newTotalBudget.minus(budget.totalSpent);

  const updatedBudget = await prisma.monthlyBudget.update({
    where: { id: budget.id },
    data: {
      baseAmount: newBaseAmount,
      totalBudget: newTotalBudget,
      balance: newBalance,
    },
  });

  return toMonthlyBudgetResponse(updatedBudget);
}

/**
 * 월별 예산 재계산
 * Expense가 추가/수정/삭제될 때 호출됨
 */
export async function recalculateMonthlyBudget(
  monthlyBudgetId: string
): Promise<MonthlyBudgetResponse> {
  const budget = await prisma.monthlyBudget.findUnique({
    where: { id: monthlyBudgetId },
    include: { expenses: true },
  });

  if (!budget) {
    throw new Error('Monthly budget not found');
  }

  // 총 사용액 계산
  const totalSpent = budget.expenses.reduce(
    (sum, expense) => sum.plus(expense.amount),
    new Decimal(0)
  );

  // 잔액 계산
  const balance = budget.totalBudget.minus(totalSpent);

  // 업데이트
  const updatedBudget = await prisma.monthlyBudget.update({
    where: { id: monthlyBudgetId },
    data: {
      totalSpent,
      balance,
    },
  });

  return toMonthlyBudgetResponse(updatedBudget);
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
): Promise<MonthlyBudgetResponse> {
  const fromBudget = await getOrCreateMonthlyBudget(fromYear, fromMonth);

  // 대상 월이 이미 존재하는지 확인
  const existingBudget = await prisma.monthlyBudget.findUnique({
    where: {
      year_month: { year: toYear, month: toMonth },
    },
  });

  if (existingBudget) {
    throw new Error('Target month budget already exists');
  }

  const carriedAmount = new Decimal(fromBudget.balance);
  const baseAmount = new Decimal(newBaseAmount);
  const totalBudget = baseAmount.plus(carriedAmount);

  const newBudget = await prisma.monthlyBudget.create({
    data: {
      year: toYear,
      month: toMonth,
      baseAmount,
      carriedAmount,
      totalBudget,
      totalSpent: new Decimal(0),
      balance: totalBudget,
    },
  });

  return toMonthlyBudgetResponse(newBudget);
}

/**
 * 월별 리포트 조회
 * 특정 월의 예산 정보와 상세 통계를 반환
 */
export async function getMonthlyReport(
  year: number,
  month: number
): Promise<MonthlyReportResponse> {
  // 예산 정보 조회
  const budget = await getOrCreateMonthlyBudget(year, month);

  // 해당 월의 모든 지출 내역 조회
  const expenses = await prisma.expense.findMany({
    where: {
      monthlyBudget: {
        year,
        month,
      },
    },
    orderBy: {
      expenseDate: 'desc',
    },
  });

  const expenseResponses: ExpenseResponse[] = expenses.map((expense) =>
    convertDecimalsToNumbers(expense as unknown as Record<string, unknown>)
  ) as unknown as ExpenseResponse[];

  // 일별 통계 계산
  const dailyMap = new Map<string, { amount: Decimal; count: number }>();
  expenses.forEach((expense) => {
    const dateKey = expense.expenseDate.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || { amount: new Decimal(0), count: 0 };
    dailyMap.set(dateKey, {
      amount: existing.amount.plus(expense.amount),
      count: existing.count + 1,
    });
  });

  const dailyBreakdown: DailyBreakdown[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      amount: data.amount.toNumber(),
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 작성자별 통계 계산
  const authorMap = new Map<string, { amount: Decimal; count: number }>();
  expenses.forEach((expense) => {
    const existing = authorMap.get(expense.authorName) || { amount: new Decimal(0), count: 0 };
    authorMap.set(expense.authorName, {
      amount: existing.amount.plus(expense.amount),
      count: existing.count + 1,
    });
  });

  const authorBreakdown: AuthorBreakdown[] = Array.from(authorMap.entries())
    .map(([authorName, data]) => ({
      authorName,
      amount: data.amount.toNumber(),
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 상위 5개 지출 내역
  const topExpenses = expenseResponses.sort((a, b) => b.amount - a.amount).slice(0, 5);

  return {
    budget,
    statistics: {
      totalExpenses: budget.totalSpent,
      expenseCount: expenses.length,
      dailyBreakdown,
      authorBreakdown,
      topExpenses,
    },
  };
}
