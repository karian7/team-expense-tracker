/**
 * 동기화 서비스
 * 클라이언트와 서버 간 데이터 동기화
 */

import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface PullRequest {
  entities: Array<'budgets' | 'expenses' | 'settings'>;
  lastSyncTime: Record<string, string>;
}

interface PushRequest {
  changes: Array<{
    entity: 'budgets' | 'expenses' | 'settings';
    operation: 'create' | 'update' | 'delete';
    data: unknown;
  }>;
}

/**
 * Pull: 클라이언트에게 서버 변경사항 전송
 */
export async function pull(request: PullRequest) {
  const { lastSyncTime } = request;

  // 각 엔티티의 변경사항 조회
  const budgets = await prisma.monthlyBudget.findMany({
    where: {
      updatedAt: {
        gt: lastSyncTime.budgets ? new Date(lastSyncTime.budgets) : new Date(0),
      },
    },
  });

  const expenses = await prisma.expense.findMany({
    where: {
      updatedAt: {
        gt: lastSyncTime.expenses ? new Date(lastSyncTime.expenses) : new Date(0),
      },
    },
  });

  const settings = await prisma.settings.findMany({
    where: {
      updatedAt: {
        gt: lastSyncTime.settings ? new Date(lastSyncTime.settings) : new Date(0),
      },
    },
  });

  return {
    budgets: budgets.map(convertDecimalsInBudget),
    expenses: expenses.map(convertDecimalsInExpense),
    settings,
    syncTime: new Date().toISOString(),
  };
}

/**
 * Push: 클라이언트 변경사항을 서버에 적용
 */
export async function push(request: PushRequest) {
  const accepted: Array<{ id: string; status: 'success' }> = [];
  const conflicts: Array<unknown> = [];

  for (const change of request.changes) {
    try {
      if (change.entity === 'budgets') {
        await handleBudgetChange(change, accepted, conflicts);
      } else if (change.entity === 'expenses') {
        await handleExpenseChange(change, accepted, conflicts);
      } else if (change.entity === 'settings') {
        await handleSettingsChange(change, accepted, conflicts);
      }
    } catch (error) {
      console.error(`Error processing change for ${change.entity}:`, error);
    }
  }

  return {
    accepted,
    conflicts,
    syncTime: new Date().toISOString(),
  };
}

/**
 * Budget 변경 처리
 */
async function handleBudgetChange(
  change: { operation: string; data: any },
  accepted: Array<{ id: string; status: 'success' }>,
  conflicts: Array<unknown>
) {
  const data = change.data;

  if (change.operation === 'delete') {
    await prisma.monthlyBudget.delete({
      where: { id: data.id },
    });
    accepted.push({ id: data.id, status: 'success' });
    return;
  }

  const existing = await prisma.monthlyBudget.findUnique({
    where: { id: data.id },
  });

  const budgetData = {
    year: data.year,
    month: data.month,
    baseAmount: new Decimal(data.baseAmount),
    carriedAmount: new Decimal(data.carriedAmount),
    totalBudget: new Decimal(data.totalBudget),
    totalSpent: new Decimal(data.totalSpent),
    balance: new Decimal(data.balance),
    updatedAt: new Date(data.updatedAt),
  };

  if (!existing || new Date(existing.updatedAt) < new Date(data.updatedAt)) {
    // 클라이언트가 더 최신 또는 신규
    await prisma.monthlyBudget.upsert({
      where: { id: data.id },
      update: budgetData,
      create: {
        id: data.id,
        ...budgetData,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      },
    });
    accepted.push({ id: data.id, status: 'success' });
  } else if (new Date(existing.updatedAt).getTime() === new Date(data.updatedAt).getTime()) {
    // 시간 동일 - 버전으로 판단 (클라이언트에는 version 없으므로 서버 우선)
    conflicts.push({
      id: data.id,
      entity: 'budgets',
      clientVersion: data,
      serverVersion: existing,
      resolution: 'server_wins',
    });
  } else {
    // 서버가 더 최신 - 충돌
    conflicts.push({
      id: data.id,
      entity: 'budgets',
      clientVersion: data,
      serverVersion: existing,
      resolution: 'server_wins',
    });
  }
}

/**
 * Expense 변경 처리
 */
async function handleExpenseChange(
  change: { operation: string; data: any },
  accepted: Array<{ id: string; status: 'success' }>,
  conflicts: Array<unknown>
) {
  const data = change.data;

  if (change.operation === 'delete') {
    await prisma.expense.delete({
      where: { id: data.id },
    });
    accepted.push({ id: data.id, status: 'success' });
    return;
  }

  const existing = await prisma.expense.findUnique({
    where: { id: data.id },
  });

  const expenseData = {
    monthlyBudgetId: data.monthlyBudgetId,
    authorName: data.authorName,
    amount: new Decimal(data.amount),
    expenseDate: new Date(data.expenseDate),
    storeName: data.storeName || null,
    receiptImageUrl: data.receiptImageUrl,
    ocrRawData: data.ocrRawData || null,
    updatedAt: new Date(data.updatedAt),
  };

  if (!existing || new Date(existing.updatedAt) < new Date(data.updatedAt)) {
    await prisma.expense.upsert({
      where: { id: data.id },
      update: expenseData,
      create: {
        id: data.id,
        ...expenseData,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      },
    });
    accepted.push({ id: data.id, status: 'success' });
  } else {
    conflicts.push({
      id: data.id,
      entity: 'expenses',
      clientVersion: data,
      serverVersion: existing,
      resolution: 'server_wins',
    });
  }
}

/**
 * Settings 변경 처리
 */
async function handleSettingsChange(
  change: { operation: string; data: any },
  accepted: Array<{ id: string; status: 'success' }>,
  conflicts: Array<unknown>
) {
  const data = change.data;

  const existing = await prisma.settings.findUnique({
    where: { key: data.key },
  });

  const settingsData = {
    value: data.value,
    description: data.description || null,
    updatedAt: new Date(data.updatedAt),
  };

  if (!existing || new Date(existing.updatedAt) < new Date(data.updatedAt)) {
    await prisma.settings.upsert({
      where: { key: data.key },
      update: settingsData,
      create: {
        key: data.key,
        ...settingsData,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      },
    });
    accepted.push({ id: data.key, status: 'success' });
  } else {
    conflicts.push({
      id: data.key,
      entity: 'settings',
      clientVersion: data,
      serverVersion: existing,
      resolution: 'server_wins',
    });
  }
}

/**
 * Decimal 값을 number로 변환 (Budget)
 */
function convertDecimalsInBudget(budget: any) {
  return {
    ...budget,
    baseAmount: budget.baseAmount.toNumber(),
    carriedAmount: budget.carriedAmount.toNumber(),
    totalBudget: budget.totalBudget.toNumber(),
    totalSpent: budget.totalSpent.toNumber(),
    balance: budget.balance.toNumber(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  };
}

/**
 * Decimal 값을 number로 변환 (Expense)
 */
function convertDecimalsInExpense(expense: any) {
  return {
    ...expense,
    amount: expense.amount.toNumber(),
    expenseDate: expense.expenseDate.toISOString().split('T')[0],
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}
