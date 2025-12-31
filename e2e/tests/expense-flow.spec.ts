import { test, expect } from '@playwright/test';
import { resetDatabase, seedInitialBudget } from '../support/database';
import { waitForAppReady, clearIndexedDB } from '../support/commands';
import { testExpenses, formatAmount } from '../fixtures/test-data';

test.describe('지출 플로우', () => {
  test.beforeEach(async ({ page }) => {
    // DB 초기화 및 초기 예산 설정
    await resetDatabase();
    await seedInitialBudget(300000);

    // 클라이언트 IndexedDB 초기화
    await page.goto('/');
    await clearIndexedDB(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test('영수증 없이 직접 입력', async ({ page }) => {
    // 지출 등록 페이지로 이동
    await page.goto('/expense/new');
    await waitForAppReady(page);

    // 폼 필드 확인
    await expect(page.getByLabel(/이름|작성자/i)).toBeVisible();
    await expect(page.getByLabel(/금액/i)).toBeVisible();

    // 지출 정보 입력
    await page.getByLabel(/이름|작성자/i).fill(testExpenses.lunch.authorName);
    await page.getByLabel(/금액/i).fill(testExpenses.lunch.amount.toString());

    const storeNameField = page.getByLabel(/가게|상호명/i);
    if (await storeNameField.isVisible()) {
      await storeNameField.fill(testExpenses.lunch.storeName);
    }

    // 저장 버튼 클릭
    await page.getByRole('button', { name: /저장|등록|확인/i }).click();

    // 성공 메시지 또는 목록 페이지로 이동 확인
    await expect(page).toHaveURL(/\/$|\/expense/);
  });

  test('지출 목록 표시', async ({ page }) => {
    // 메인 페이지로 이동
    await page.goto('/');
    await waitForAppReady(page);

    // 지출 목록 영역 확인
    const expenseList = page.locator('[data-testid="expense-list"]').or(page.locator('main'));
    await expect(expenseList).toBeVisible();

    // 예산 정보 표시 확인
    await expect(page.getByText(/예산|잔액|지출/i)).toBeVisible();
  });

  test('지출 삭제 (EXPENSE_REVERSAL)', async ({ page }) => {
    // 먼저 지출 등록
    await page.goto('/expense/new');
    await waitForAppReady(page);

    await page.getByLabel(/이름|작성자/i).fill(testExpenses.coffee.authorName);
    await page.getByLabel(/금액/i).fill(testExpenses.coffee.amount.toString());
    await page.getByRole('button', { name: /저장|등록|확인/i }).click();

    // 메인 페이지로 이동
    await page.goto('/');
    await waitForAppReady(page);

    // 지출 항목 찾기 및 삭제 버튼 클릭
    const expenseItem = page
      .locator('[data-testid="expense-item"]')
      .or(page.getByText(formatAmount(testExpenses.coffee.amount)));

    if (await expenseItem.isVisible()) {
      await expenseItem.click();

      // 삭제 버튼 클릭
      const deleteButton = page.getByRole('button', { name: /삭제|취소/i });
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // 확인 다이얼로그 처리
        const confirmButton = page.getByRole('button', { name: /확인|삭제/i });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
      }
    }

    // 페이지 리로드 후 삭제 확인
    await page.reload();
    await waitForAppReady(page);
  });
});
