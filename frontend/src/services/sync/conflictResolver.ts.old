/**
 * 동기화 충돌 해결
 * Last-Write-Wins (LWW) 전략 사용
 */

import { db, type MonthlyBudget, type Expense, type Settings } from '../db/database';
import type { Conflict, SyncEntity } from './types';

/**
 * 충돌 해결: Last-Write-Wins 전략
 * updatedAt이 더 최신인 버전을 채택
 * 동일하면 version 번호로 판단
 */
export async function resolveConflict(conflict: Conflict): Promise<void> {
  const { entity, clientVersion, serverVersion } = conflict;

  // 시간 비교
  const clientTime = new Date(clientVersion.updatedAt).getTime();
  const serverTime = new Date(serverVersion.updatedAt).getTime();

  let winningVersion: typeof clientVersion | typeof serverVersion;

  if (serverTime > clientTime) {
    // 서버가 더 최신
    winningVersion = serverVersion;
  } else if (serverTime < clientTime) {
    // 클라이언트가 더 최신
    winningVersion = clientVersion;
  } else {
    // 시간이 동일하면 버전 번호로 판단
    if (serverVersion.version >= clientVersion.version) {
      winningVersion = serverVersion;
    } else {
      winningVersion = clientVersion;
    }
  }

  // 승리한 버전을 로컬 DB에 저장
  await applyWinningVersion(entity, winningVersion.data);
}

/**
 * 승리한 버전을 로컬 DB에 적용
 */
async function applyWinningVersion(
  entity: SyncEntity,
  data: MonthlyBudget | Expense | Settings
): Promise<void> {
  switch (entity) {
    case 'budgets':
      await db.monthlyBudgets.put(data as MonthlyBudget);
      break;
    case 'expenses':
      await db.expenses.put(data as Expense);
      break;
    case 'settings':
      await db.settings.put(data as Settings);
      break;
  }
}

/**
 * 여러 충돌을 일괄 해결
 */
export async function resolveConflicts(conflicts: Conflict[]): Promise<void> {
  for (const conflict of conflicts) {
    await resolveConflict(conflict);
  }
}

/**
 * 충돌 감지: 클라이언트와 서버 버전 비교
 */
export function detectConflict(
  clientData: MonthlyBudget | Expense | Settings,
  serverData: MonthlyBudget | Expense | Settings
): boolean {
  // updatedAt이 다르거나 version이 다르면 충돌
  return clientData.updatedAt !== serverData.updatedAt || clientData.version !== serverData.version;
}

export const conflictResolver = {
  resolveConflict,
  resolveConflicts,
  detectConflict,
};
