import { db, Expense, now, generateId } from '../db/database';
import { budgetService } from './budgetService';

/**
 * 날짜 문자열에서 년/월 추출
 */
function extractYearMonth(dateStr: string) {
  const date = new Date(dateStr);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1, // 0-based → 1-based
  };
}

/**
 * 지출 생성 요청 데이터
 */
export interface CreateExpenseData {
  authorName: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  storeName?: string;
  receiptImageUrl: string;
  receiptImageBlob?: Blob;
  ocrRawData?: unknown;
}

/**
 * 지출 수정 요청 데이터
 */
export interface UpdateExpenseData {
  authorName?: string;
  amount?: number;
  expenseDate?: string;
  storeName?: string;
}

/**
 * 지출 조회 필터
 */
export interface ExpenseFilter {
  year?: number;
  month?: number;
  authorName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * 사용 내역 생성
 */
export async function createExpense(data: CreateExpenseData): Promise<Expense> {
  const { year, month } = extractYearMonth(data.expenseDate);

  // 해당 월의 예산 가져오기 (없으면 생성)
  const monthlyBudget = await budgetService.getOrCreateMonthlyBudget(year, month);

  const timestamp = now();
  const expense: Expense = {
    id: generateId(),
    monthlyBudgetId: monthlyBudget.id,
    authorName: data.authorName,
    amount: data.amount,
    expenseDate: data.expenseDate,
    storeName: data.storeName,
    receiptImageUrl: data.receiptImageUrl,
    receiptImageBlob: data.receiptImageBlob,
    ocrRawData: data.ocrRawData ? JSON.stringify(data.ocrRawData) : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    deleted: false,
  };

  await db.expenses.add(expense);

  // 월별 예산 재계산
  await budgetService.recalculateMonthlyBudget(monthlyBudget.id);

  return expense;
}

/**
 * 사용 내역 조회 (필터링 지원)
 */
export async function getExpenses(filter: ExpenseFilter = {}): Promise<Expense[]> {
  let query = db.expenses.where('deleted').equals(false);

  // 연도/월 필터
  if (filter.year !== undefined && filter.month !== undefined) {
    const monthlyBudget = await budgetService.getMonthlyBudget(filter.year, filter.month);

    if (!monthlyBudget) {
      // 해당 월이 없으면 빈 배열 반환
      return [];
    }

    query = db.expenses
      .where('monthlyBudgetId')
      .equals(monthlyBudget.id)
      .and((e) => !e.deleted);
  }

  let expenses = await query.toArray();

  // 작성자 필터
  if (filter.authorName) {
    expenses = expenses.filter((e) =>
      e.authorName.toLowerCase().includes(filter.authorName!.toLowerCase())
    );
  }

  // 날짜 범위 필터
  if (filter.startDate || filter.endDate) {
    expenses = expenses.filter((e) => {
      const expenseDate = e.expenseDate;
      if (filter.startDate && expenseDate < filter.startDate) return false;
      if (filter.endDate && expenseDate > filter.endDate) return false;
      return true;
    });
  }

  // 정렬: 최신순
  expenses.sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));

  // Limit/Offset
  if (filter.offset !== undefined) {
    expenses = expenses.slice(filter.offset);
  }
  if (filter.limit !== undefined) {
    expenses = expenses.slice(0, filter.limit);
  }

  return expenses;
}

/**
 * 특정 사용 내역 조회
 */
export async function getExpenseById(id: string): Promise<Expense | undefined> {
  const expense = await db.expenses.get(id);
  return expense && !expense.deleted ? expense : undefined;
}

/**
 * 사용 내역 수정
 */
export async function updateExpense(id: string, data: UpdateExpenseData): Promise<Expense> {
  const expense = await db.expenses.get(id);

  if (!expense || expense.deleted) {
    throw new Error('Expense not found');
  }

  const updates: Partial<Expense> = {
    updatedAt: now(),
    version: expense.version + 1,
  };

  let newMonthlyBudgetId: string | null = null;

  if (data.authorName !== undefined) {
    updates.authorName = data.authorName;
  }

  if (data.amount !== undefined) {
    updates.amount = data.amount;
  }

  if (data.expenseDate !== undefined) {
    const { year, month } = extractYearMonth(data.expenseDate);
    const oldYearMonth = extractYearMonth(expense.expenseDate);

    // 날짜가 다른 월로 변경되는 경우
    if (year !== oldYearMonth.year || month !== oldYearMonth.month) {
      const newMonthlyBudget = await budgetService.getOrCreateMonthlyBudget(year, month);
      updates.monthlyBudgetId = newMonthlyBudget.id;
      newMonthlyBudgetId = newMonthlyBudget.id;
    }

    updates.expenseDate = data.expenseDate;
  }

  if (data.storeName !== undefined) {
    updates.storeName = data.storeName;
  }

  const oldMonthlyBudgetId = expense.monthlyBudgetId;

  await db.expenses.update(id, updates);

  // 이전 월 예산 재계산
  await budgetService.recalculateMonthlyBudget(oldMonthlyBudgetId);

  // 새 월 예산 재계산 (월이 변경된 경우)
  if (newMonthlyBudgetId && newMonthlyBudgetId !== oldMonthlyBudgetId) {
    await budgetService.recalculateMonthlyBudget(newMonthlyBudgetId);
  }

  return { ...expense, ...updates };
}

/**
 * 사용 내역 삭제 (soft delete)
 */
export async function deleteExpense(id: string): Promise<void> {
  const expense = await db.expenses.get(id);

  if (!expense || expense.deleted) {
    throw new Error('Expense not found');
  }

  const monthlyBudgetId = expense.monthlyBudgetId;

  // Soft delete
  await db.expenses.update(id, {
    deleted: true,
    updatedAt: now(),
  });

  // 월별 예산 재계산
  await budgetService.recalculateMonthlyBudget(monthlyBudgetId);
}

/**
 * 특정 월의 모든 사용 내역 조회
 */
export async function getExpensesByMonth(year: number, month: number): Promise<Expense[]> {
  return getExpenses({ year, month });
}

export const expenseService = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpensesByMonth,
};
