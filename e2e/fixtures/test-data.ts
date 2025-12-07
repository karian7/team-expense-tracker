export const TEST_DATA = {
  initialBudget: 1000000,
  defaultMonthlyBudget: 500000,
  expenses: [
    {
      amount: 50000,
      date: '2024-12-01',
      storeName: '테스트식당',
      authorName: '홍길동',
    },
    {
      amount: 70000,
      date: '2024-12-02',
      storeName: '카페',
      authorName: '김철수',
    },
    {
      amount: 30000,
      date: '2024-12-03',
      storeName: '분식집',
      authorName: '이영희',
    },
  ],
  csvData: `ID,작성자,금액,사용날짜,상호명
,홍길동,30000,2024-12-01,테스트식당
,김철수,25000,2024-12-02,카페`,
};

export const SAMPLE_RECEIPT_PATH = './e2e/fixtures/sample-receipt.jpg';
