import prisma from '../utils/prisma';
import { expensesToCsv, parseCsvToExpenses, CsvExpenseRow } from '../utils/csv';
import { createExpense } from './expenseService';

/**
 * 모든 사용 내역을 CSV로 export
 */
export async function exportAllExpensesToCsv(): Promise<string> {
  const expenses = await prisma.expense.findMany({
    orderBy: { expenseDate: 'desc' },
  });

  return expensesToCsv(expenses);
}

/**
 * 특정 기간의 사용 내역을 CSV로 export
 */
export async function exportExpensesByPeriodToCsv(
  startDate: Date,
  endDate: Date
): Promise<string> {
  const expenses = await prisma.expense.findMany({
    where: {
      expenseDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { expenseDate: 'desc' },
  });

  return expensesToCsv(expenses);
}

/**
 * CSV 데이터를 import하여 사용 내역 생성
 * receiptImageUrl은 기본값 사용
 */
export async function importExpensesFromCsv(
  csvContent: string,
  defaultReceiptUrl: string = '/uploads/imported.jpg'
): Promise<{ success: number; failed: number; errors: string[] }> {
  const rows = parseCsvToExpenses(csvContent);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await createExpense({
        authorName: row.authorName,
        amount: row.amount,
        expenseDate: row.expenseDate,
        storeName: row.storeName,
        receiptImageUrl: defaultReceiptUrl,
      });
      success++;
    } catch (error) {
      failed++;
      errors.push(
        `${row.authorName} - ${row.amount}원: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`
      );
    }
  }

  return { success, failed, errors };
}
