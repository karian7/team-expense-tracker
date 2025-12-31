import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function resetDatabase(): Promise<void> {
  try {
    // 모든 이벤트 삭제를 위한 BUDGET_RESET 이벤트 생성
    await axios.post(`${API_URL}/api/events`, {
      eventType: 'BUDGET_RESET',
      eventDate: new Date().toISOString(),
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      authorName: 'E2E_TEST',
      amount: 0,
      description: 'E2E 테스트용 데이터 초기화',
    });
  } catch (error) {
    console.error('Failed to reset database:', error);
    throw error;
  }
}

export async function seedInitialBudget(amount: number = 300000): Promise<void> {
  try {
    await axios.post(`${API_URL}/api/settings/initial-budget`, {
      initialBudget: amount,
    });
  } catch (error) {
    console.error('Failed to seed initial budget:', error);
    throw error;
  }
}

export async function createTestExpense(data: {
  authorName: string;
  amount: number;
  storeName?: string;
  description?: string;
}): Promise<void> {
  const now = new Date();
  await axios.post(`${API_URL}/api/events`, {
    eventType: 'EXPENSE',
    eventDate: now.toISOString(),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    authorName: data.authorName,
    amount: data.amount,
    storeName: data.storeName || '테스트 식당',
    description: data.description || '테스트 지출',
  });
}

export async function getAppSettings(): Promise<{
  defaultMonthlyBudget: number;
  initialBudget: number;
  needsFullSync: boolean;
}> {
  const { data } = await axios.get(`${API_URL}/api/settings`);
  return data.data;
}
