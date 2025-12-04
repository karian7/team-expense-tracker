import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { expensesToCsv, parseCsvToExpenses } from '../utils/csv';
import { extractYearMonth } from '../utils/date';
import { getOrCreateMonthlyBudget, recalculateMonthlyBudget } from './budgetService';

/**
 * 모든 사용 내역을 CSV로 export (백업용)
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
export async function exportExpensesByPeriodToCsv(startDate: Date, endDate: Date): Promise<string> {
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
 * CSV 데이터를 import하여 사용 내역 복원 (upsert)
 * - ID가 있으면 해당 ID로 업데이트 (복원)
 * - ID가 없으면 새로 생성
 */
export async function importExpensesFromCsv(
  csvContent: string,
  defaultReceiptUrl: string = '/uploads/imported.jpg'
): Promise<{
  success: number;
  failed: number;
  updated: number;
  created: number;
  errors: string[];
}> {
  const rows = parseCsvToExpenses(csvContent);

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  const affectedBudgets = new Set<string>();

  for (const row of rows) {
    try {
      const expenseDate = new Date(row.expenseDate);
      const { year, month } = extractYearMonth(row.expenseDate);

      // 해당 월의 예산 가져오기 (없으면 생성)
      const monthlyBudget = await getOrCreateMonthlyBudget(year, month);
      affectedBudgets.add(monthlyBudget.id);

      if (row.id) {
        // ID가 있으면 upsert (복원)
        const existing = await prisma.expense.findUnique({
          where: { id: row.id },
        });

        await prisma.expense.upsert({
          where: { id: row.id },
          create: {
            id: row.id,
            monthlyBudgetId: monthlyBudget.id,
            authorName: row.authorName,
            amount: new Decimal(row.amount),
            expenseDate,
            storeName: row.storeName || null,
            receiptImageUrl: defaultReceiptUrl,
          },
          update: {
            monthlyBudgetId: monthlyBudget.id,
            authorName: row.authorName,
            amount: new Decimal(row.amount),
            expenseDate,
            storeName: row.storeName || null,
          },
        });

        if (existing) {
          updated++;
        } else {
          created++;
        }
      } else {
        // ID가 없으면 새로 생성
        await prisma.expense.create({
          data: {
            monthlyBudgetId: monthlyBudget.id,
            authorName: row.authorName,
            amount: new Decimal(row.amount),
            expenseDate,
            storeName: row.storeName || null,
            receiptImageUrl: defaultReceiptUrl,
          },
        });
        created++;
      }
    } catch (error) {
      failed++;
      errors.push(
        `${row.id || 'NEW'} - ${row.authorName} - ${row.amount}원: ${
          error instanceof Error ? error.message : '알 수 없는 오류'
        }`
      );
    }
  }

  // 영향받은 모든 월별 예산 재계산
  for (const budgetId of affectedBudgets) {
    await recalculateMonthlyBudget(budgetId);
  }

  return {
    success: created + updated,
    created,
    updated,
    failed,
    errors,
  };
}
