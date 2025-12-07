import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  setDefaultMonthlyBudget,
  addExpenseManually,
  waitForBudgetSync,
} from '../utils/helpers';
import { TEST_DATA } from '../fixtures/test-data';

test.describe('사용 내역 관리 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setInitialBudget(1000000);
    await setDefaultMonthlyBudget(500000);
    await page.goto('/');
    await waitForBudgetSync(page);
  });

  test('TC-009: 사용 내역 추가', async ({ page }) => {
    await page.waitForTimeout(2000);

    const expense = TEST_DATA.expenses[0];
    await addExpenseManually(page, expense);

    // 사용 내역 목록에 표시되는지 확인
    await expect(page.locator(`text=${expense.storeName}`)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(`text=${expense.authorName}`)).toBeVisible();
    await expect(page.locator(`text=₩${expense.amount.toLocaleString('ko-KR')}`)).toBeVisible();

    // 잔액이 감소했는지 확인
    const remainingBudget = 500000 - expense.amount;
    await expect(page.locator(`text=₩${remainingBudget.toLocaleString('ko-KR')}`)).toBeVisible();
  });

  test('TC-010: 사용 내역 상세보기', async ({ page }) => {
    await page.waitForTimeout(2000);

    const expense = TEST_DATA.expenses[0];
    await addExpenseManually(page, expense);

    // 사용 내역 클릭
    await page.click(`text=${expense.storeName}`);

    // 모달에서 상세 정보 확인
    await expect(page.locator('text=작성자').first()).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator(`text=${expense.authorName}`)).toBeVisible();
    await expect(page.locator(`text=${expense.storeName}`)).toBeVisible();

    // 닫기 버튼으로 모달 닫기
    await page.click('button:has-text("닫기")');
    await expect(page.locator('text=작성자').first()).not.toBeVisible();
  });

  test('TC-011: 사용 내역 삭제', async ({ page }) => {
    await page.waitForTimeout(2000);

    const expense = TEST_DATA.expenses[0];
    await addExpenseManually(page, expense);

    // 초기 잔액 확인
    const remainingBudget = 500000 - expense.amount;
    await expect(page.locator(`text=₩${remainingBudget.toLocaleString('ko-KR')}`)).toBeVisible();

    // 삭제 버튼 클릭
    await page.click('[aria-label="삭제"]');

    // 확인 다이얼로그
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('삭제');
      dialog.accept();
    });

    await page.waitForTimeout(1000);

    // 사용 내역이 제거되었는지 확인
    await expect(page.locator(`text=${expense.storeName}`)).not.toBeVisible();

    // 잔액이 복원되었는지 확인
    await expect(page.locator('text=₩500,000')).toBeVisible();
  });

  test('TC-012: 작성자별 필터링', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 여러 사용 내역 추가
    for (const expense of TEST_DATA.expenses) {
      await addExpenseManually(page, expense);
      await page.waitForTimeout(500);
    }

    // 작성자 필터 선택
    await page.selectOption('select[aria-label="작성자 필터"]', '홍길동');
    await page.waitForTimeout(500);

    // 홍길동의 내역만 표시되는지 확인
    await expect(page.locator('text=홍길동')).toBeVisible();
    await expect(page.locator('text=김철수')).not.toBeVisible();
    await expect(page.locator('text=이영희')).not.toBeVisible();

    // 전체 선택
    await page.selectOption('select[aria-label="작성자 필터"]', '');
    await page.waitForTimeout(500);

    // 모든 내역 표시되는지 확인
    await expect(page.locator('text=홍길동')).toBeVisible();
    await expect(page.locator('text=김철수')).toBeVisible();
    await expect(page.locator('text=이영희')).toBeVisible();
  });

  test('TC-018: 자동 잔액 계산', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 초기 잔액 확인
    await expect(page.locator('text=₩500,000')).toBeVisible();

    // 50,000원 사용 내역 추가
    const expense = TEST_DATA.expenses[0];
    await addExpenseManually(page, expense);

    // 잔액 확인 (450,000원)
    const afterAdd = 500000 - expense.amount;
    await expect(page.locator(`text=₩${afterAdd.toLocaleString('ko-KR')}`)).toBeVisible({
      timeout: 5000,
    });

    // 내역 삭제
    await page.click('[aria-label="삭제"]');
    page.once('dialog', (dialog) => dialog.accept());
    await page.waitForTimeout(1000);

    // 잔액 복원 확인 (500,000원)
    await expect(page.locator('text=₩500,000')).toBeVisible();
  });

  test('TC-019: 예산 초과 경고', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 예산의 91% 사용 (455,000원)
    const expense = {
      amount: 455000,
      date: '2024-12-01',
      storeName: '대형 회식',
      authorName: '홍길동',
    };
    await addExpenseManually(page, expense);

    // 경고 메시지 확인
    await expect(page.locator('text=예산의')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=%')).toBeVisible();
  });

  test('TC-020: 예산 초과 상태', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 예산 초과 사용 (550,000원)
    const expense = {
      amount: 550000,
      date: '2024-12-01',
      storeName: '초과 회식',
      authorName: '홍길동',
    };
    await addExpenseManually(page, expense);

    // 음수 잔액 확인
    await expect(page.locator('text=-₩50,000')).toBeVisible({
      timeout: 5000,
    });

    // 초과 경고 메시지 확인
    await expect(page.locator('text=예산을 초과')).toBeVisible();
  });
});
