import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  setDefaultMonthlyBudget,
  addExpenseManually,
  openSettingsPage,
  closeSettingsPage,
  waitForBudgetSync,
  getCurrentMonthBudget,
} from '../utils/helpers';
import { TEST_DATA } from '../fixtures/test-data';

test.describe('통합 시나리오 테스트', () => {
  test('TC-024: 전체 플로우 테스트', async ({ page }) => {
    // 1. 초기 설정
    await resetDatabase();
    await page.goto('/');
    await waitForBudgetSync(page);

    await openSettingsPage(page);

    // 초기 예산 설정
    await page.fill('input[placeholder*="초기 예산"]', '1000000');
    await page.click('button:has-text("모든 데이터 삭제")');

    page.once('dialog', (dialog) => dialog.accept());
    await page.waitForTimeout(500);
    page.once('dialog', (dialog) => dialog.accept());

    await expect(page.locator('text=초기 예산이 설정')).toBeVisible({
      timeout: 5000,
    });

    // 기본 월별 예산 설정
    await page.fill('input[placeholder*="월별 기본"]', '500000');
    await page.click('button:has-text("설정 저장")');

    await expect(page.locator('text=설정이 저장')).toBeVisible({
      timeout: 5000,
    });

    await closeSettingsPage(page);
    await page.reload();
    await waitForBudgetSync(page);

    // 2. 첫 달 사용
    await page.waitForTimeout(2000);

    // 예산 확인
    await expect(page.locator('text=₩500,000')).toBeVisible({
      timeout: 10000,
    });

    // 영수증 3개 추가
    const expenses = [
      { amount: 50000, date: '2024-12-01', storeName: '식당1', authorName: '홍길동' },
      { amount: 70000, date: '2024-12-02', storeName: '식당2', authorName: '김철수' },
      { amount: 30000, date: '2024-12-03', storeName: '식당3', authorName: '이영희' },
    ];

    for (const expense of expenses) {
      await addExpenseManually(page, expense);
      await page.waitForTimeout(1000);
    }

    // 총 사용액 확인 (150,000원)
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    await expect(page.locator(`text=₩${totalSpent.toLocaleString('ko-KR')}`)).toBeVisible();

    // 잔액 확인 (350,000원)
    const remainingBudget = 500000 - totalSpent;
    await expect(page.locator(`text=₩${remainingBudget.toLocaleString('ko-KR')}`)).toBeVisible();

    // 3. 데이터 백업
    await openSettingsPage(page);

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("백업 다운로드")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/expenses_\d{4}-\d{2}-\d{2}\.csv/);

    await closeSettingsPage(page);

    // 4. 필터링 및 조회
    // 작성자별 필터
    await page.selectOption('select[aria-label="작성자 필터"]', '홍길동');
    await page.waitForTimeout(500);

    await expect(page.locator('text=홍길동')).toBeVisible();
    await expect(page.locator('text=김철수')).not.toBeVisible();

    // 전체 보기
    await page.selectOption('select[aria-label="작성자 필터"]', '');
    await page.waitForTimeout(500);

    // 상세보기
    await page.click('text=식당1');
    await expect(page.locator('text=홍길동')).toBeVisible();
    await page.click('button:has-text("닫기")');

    // 5. 백엔드 데이터 일관성 확인
    const budget = await getCurrentMonthBudget();
    expect(budget.totalBudget).toBe(500000);
    expect(budget.balance).toBe(remainingBudget);
    expect(budget.totalSpent).toBe(totalSpent);
  });
});
