export const testUsers = {
  user1: {
    name: '테스트유저1',
  },
  user2: {
    name: '테스트유저2',
  },
  system: {
    name: 'SYSTEM',
  },
};

export const testExpenses = {
  lunch: {
    authorName: testUsers.user1.name,
    amount: 50000,
    storeName: '맛있는 식당',
    description: '팀 점심 식사',
  },
  dinner: {
    authorName: testUsers.user2.name,
    amount: 80000,
    storeName: '한정식집',
    description: '팀 저녁 회식',
  },
  coffee: {
    authorName: testUsers.user1.name,
    amount: 15000,
    storeName: '스타벅스',
    description: '커피 미팅',
  },
};

export const testBudget = {
  defaultMonthlyBudget: 300000,
  initialBudget: 500000,
};

export const getCurrentYearMonth = () => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
};

export const formatAmount = (amount: number): string => {
  return amount.toLocaleString('ko-KR') + '원';
};
