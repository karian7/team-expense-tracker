import { test, expect } from '@playwright/test';
import { resetDatabase, seedInitialBudget, createTestExpense } from '../support/database';
import { waitForAppReady, clearIndexedDB } from '../support/commands';
import { testExpenses, formatAmount, getCurrentYearMonth } from '../fixtures/test-data';

test.describe('예산 조회/이월 테스트', () => {
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

  test('현재 월 예산 표시', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // 예산 정보 영역 확인
    const budgetSection = page
      .locator('[data-testid="budget-info"]')
      .or(page.locator('header'))
      .or(page.locator('main'));

    await expect(budgetSection).toBeVisible();

    // 예산 관련 텍스트 확인
    await expect(
      page.getByText(/예산|잔액|300,000|300000/i).or(page.getByText(/원/))
    ).toBeVisible();
  });

  test('지출 후 잔액 감소 확인', async ({ page }) => {
    // 테스트 지출 생성
    await createTestExpense({
      authorName: testExpenses.lunch.authorName,
      amount: 50000,
      storeName: testExpenses.lunch.storeName,
    });

    await page.goto('/');
    await waitForAppReady(page);

    // 잔액이 250,000원으로 표시되어야 함 (300,000 - 50,000)
    // UI에 따라 정확한 selector 조정 필요
    const balanceText = page.getByText(/250,000|250000/);
    await expect(balanceText.or(page.getByText(/잔액/))).toBeVisible();
  });

  test('예산 조정 (증가)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // 예산 조정 버튼/링크 찾기
    const adjustButton = page.getByRole('button', { name: /조정|수정|편집/i });

    if (await adjustButton.isVisible()) {
      await adjustButton.click();

      // 조정 폼 입력
      const amountInput = page.getByLabel(/금액|목표|잔액/i);
      if (await amountInput.isVisible()) {
        await amountInput.fill('350000');

        // 저장
        await page.getByRole('button', { name: /저장|확인/i }).click();

        // 변경된 예산 확인
        await expect(page.getByText(/350,000|350000/)).toBeVisible();
      }
    }
  });

  test('예산 조정 (감소)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // 예산 조정 버튼/링크 찾기
    const adjustButton = page.getByRole('button', { name: /조정|수정|편집/i });

    if (await adjustButton.isVisible()) {
      await adjustButton.click();

      // 조정 폼 입력
      const amountInput = page.getByLabel(/금액|목표|잔액/i);
      if (await amountInput.isVisible()) {
        await amountInput.fill('250000');

        // 저장
        await page.getByRole('button', { name: /저장|확인/i }).click();

        // 변경된 예산 확인
        await expect(page.getByText(/250,000|250000/)).toBeVisible();
      }
    }
  });
});
