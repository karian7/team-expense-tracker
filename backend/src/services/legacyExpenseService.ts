import { extractYearMonth } from '../utils/date';
import { ExpenseResponse, CreateBudgetEventRequest } from '../types';
import { createBudgetEvent, getEventsByMonth, getEventBySequence } from './budgetEventService';
import { AppError } from '../middleware/errorHandler';

/**
 * 사용 내역 생성 (레거시 호환)
 */
export async function createExpense(data: {
  authorName: string;
  amount: number;
  expenseDate: string;
  storeName?: string;
  receiptImage?: string;
  ocrRawData?: Record<string, unknown>;
}): Promise<ExpenseResponse> {
  const { year, month } = extractYearMonth(data.expenseDate);

  const eventData: CreateBudgetEventRequest = {
    eventType: 'EXPENSE',
    eventDate: data.expenseDate,
    year,
    month,
    authorName: data.authorName,
    amount: data.amount,
    storeName: data.storeName,
    receiptImage: data.receiptImage,
    ocrRawData: data.ocrRawData,
  };

  return createBudgetEvent(eventData);
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
  if (params.year && params.month) {
    const events = await getEventsByMonth(params.year, params.month);
    return events.filter((e) => e.eventType === 'EXPENSE');
  }

  // 날짜 범위나 다른 필터는 지원하지 않음 (필요시 추가)
  return [];
}

/**
 * 특정 사용 내역 조회
 */
export async function getExpenseById(sequence: number): Promise<ExpenseResponse | null> {
  return getEventBySequence(sequence);
}

/**
 * 사용 내역 수정 (Event Sourcing에서는 불가능 - 취소 후 재생성)
 */
export async function updateExpense(): Promise<ExpenseResponse> {
  throw new AppError('Update not supported in event sourcing. Create a new event instead.', 400);
}

/**
 * 사용 내역 삭제 (Event Sourcing에서는 불가능 - 취소 이벤트 생성)
 */
export async function deleteExpense(): Promise<void> {
  throw new AppError(
    'Delete not supported in event sourcing. Create a cancellation event instead.',
    400
  );
}

/**
 * 특정 월의 모든 사용 내역 조회
 */
export async function getExpensesByMonth(year: number, month: number): Promise<ExpenseResponse[]> {
  return getExpenses({ year, month });
}
