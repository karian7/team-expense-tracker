import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { convertDecimalsToNumbers } from '../utils/decimal';
import { extractYearMonth } from '../utils/date';
import { ExpenseResponse, CreateExpenseRequest, UpdateExpenseRequest } from '../types';
import { getOrCreateMonthlyBudget, recalculateMonthlyBudget } from './budgetService';

const toExpenseResponse = (expense: unknown): ExpenseResponse =>
  convertDecimalsToNumbers(
    expense as unknown as Record<string, unknown>
  ) as unknown as ExpenseResponse;

/**
 * 사용 내역 생성
 */
export async function createExpense(data: CreateExpenseRequest): Promise<ExpenseResponse> {
  const expenseDate = new Date(data.expenseDate);
  const { year, month } = extractYearMonth(data.expenseDate);

  // 해당 월의 예산 가져오기 (없으면 생성)
  const monthlyBudget = await getOrCreateMonthlyBudget(year, month);

  // Expense 생성
  const expense = await prisma.expense.create({
    data: {
      monthlyBudgetId: monthlyBudget.id,
      authorName: data.authorName,
      amount: new Decimal(data.amount),
      expenseDate,
      storeName: data.storeName || null,
      receiptImageUrl: data.receiptImageUrl,
      ocrRawData: data.ocrRawData ? JSON.stringify(data.ocrRawData) : null,
    },
  });

  // 월별 예산 재계산
  await recalculateMonthlyBudget(monthlyBudget.id);

  return toExpenseResponse(expense);
}

/**
 * 사용 내역 조회 (필터링 지원)
 */
export async function getExpenses(params: {
  year?: number;
  month?: number;
  authorName?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<ExpenseResponse[]> {
  const where: Prisma.ExpenseWhereInput = {};

  // 연도/월 필터
  if (params.year && params.month) {
    const monthlyBudget = await prisma.monthlyBudget.findUnique({
      where: {
        year_month: { year: params.year, month: params.month },
      },
    });

    if (monthlyBudget) {
      where.monthlyBudgetId = monthlyBudget.id;
    } else {
      // 해당 월이 없으면 빈 배열 반환
      return [];
    }
  }

  // 작성자 필터
  if (params.authorName) {
    where.authorName = {
      contains: params.authorName,
    };
  }

  // 날짜 범위 필터
  if (params.startDate || params.endDate) {
    where.expenseDate = {};
    if (params.startDate) {
      where.expenseDate.gte = params.startDate;
    }
    if (params.endDate) {
      where.expenseDate.lte = params.endDate;
    }
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: 'desc' },
    take: params.limit || undefined,
    skip: params.offset || undefined,
  });

  return expenses.map((item) => toExpenseResponse(item));
}

/**
 * 특정 사용 내역 조회
 */
export async function getExpenseById(id: string): Promise<ExpenseResponse | null> {
  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  return expense ? toExpenseResponse(expense) : null;
}

/**
 * 사용 내역 수정
 */
export async function updateExpense(
  id: string,
  data: UpdateExpenseRequest
): Promise<ExpenseResponse> {
  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!expense) {
    throw new Error('Expense not found');
  }

  const updateData: Prisma.ExpenseUpdateInput = {};

  if (data.authorName !== undefined) {
    updateData.authorName = data.authorName;
  }

  if (data.amount !== undefined) {
    updateData.amount = new Decimal(data.amount);
  }

  if (data.expenseDate !== undefined) {
    const newExpenseDate = new Date(data.expenseDate);
    const { year, month } = extractYearMonth(data.expenseDate);
    const oldYearMonth = extractYearMonth(expense.expenseDate.toISOString());

    // 날짜가 다른 월로 변경되는 경우
    if (year !== oldYearMonth.year || month !== oldYearMonth.month) {
      const newMonthlyBudget = await getOrCreateMonthlyBudget(year, month);
      updateData.monthlyBudgetId = newMonthlyBudget.id;
    }

    updateData.expenseDate = newExpenseDate;
  }

  if (data.storeName !== undefined) {
    updateData.storeName = data.storeName;
  }

  const oldMonthlyBudgetId = expense.monthlyBudgetId;

  const updatedExpense = await prisma.expense.update({
    where: { id },
    data: updateData,
  });

  // 이전 월 예산 재계산
  await recalculateMonthlyBudget(oldMonthlyBudgetId);

  // 새 월 예산 재계산 (월이 변경된 경우)
  if (updateData.monthlyBudgetId && updateData.monthlyBudgetId !== oldMonthlyBudgetId) {
    await recalculateMonthlyBudget(updateData.monthlyBudgetId);
  }

  return toExpenseResponse(updatedExpense);
}

/**
 * 사용 내역 삭제
 */
export async function deleteExpense(id: string): Promise<void> {
  const expense = await prisma.expense.findUnique({
    where: { id },
  });

  if (!expense) {
    throw new Error('Expense not found');
  }

  const monthlyBudgetId = expense.monthlyBudgetId;

  await prisma.expense.delete({
    where: { id },
  });

  // 월별 예산 재계산
  await recalculateMonthlyBudget(monthlyBudgetId);
}

/**
 * 특정 월의 모든 사용 내역 조회
 */
export async function getExpensesByMonth(year: number, month: number): Promise<ExpenseResponse[]> {
  return getExpenses({ year, month });
}
