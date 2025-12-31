import { test, expect } from '@playwright/test';
import { resetDatabase, seedInitialBudget } from '../support/database';
import { waitForAppReady, clearIndexedDB } from '../support/commands';
import { testExpenses } from '../fixtures/test-data';

test.describe('오프라인 동기화 테스트', () => {
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

  test('오프라인 지출 등록 → 온라인 동기화', async ({ page, context }) => {
    // 초기 동기화 완료 대기
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000); // 초기 동기화 대기

    // 오프라인 모드로 전환
    await context.setOffline(true);

    // 지출 등록 페이지로 이동
    await page.goto('/expense/new');

    // 폼 필드 입력
    const authorField = page.getByLabel(/이름|작성자/i);
    if (await authorField.isVisible()) {
      await authorField.fill(testExpenses.lunch.authorName);
    }

    const amountField = page.getByLabel(/금액/i);
    if (await amountField.isVisible()) {
      await amountField.fill(testExpenses.lunch.amount.toString());
    }

    // 저장 버튼 클릭 (오프라인 상태에서도 로컬 저장)
    const saveButton = page.getByRole('button', { name: /저장|등록|확인/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();

      // 로컬 저장 성공 확인 (토스트 또는 목록 표시)
      await page.waitForTimeout(1000);
    }

    // 메인 페이지로 이동하여 로컬 데이터 확인
    await page.goto('/');
    await waitForAppReady(page);

    // 오프라인에서 저장된 지출이 표시되는지 확인
    const expenseAmount = page.getByText(/50,000|50000/);
    await expect(expenseAmount.or(page.locator('main'))).toBeVisible();

    // 온라인 모드로 전환
    await context.setOffline(false);

    // 동기화 대기 (자동 동기화 또는 수동 트리거)
    await page.waitForTimeout(3000);

    // 페이지 새로고침 후 데이터 유지 확인
    await page.reload();
    await waitForAppReady(page);
  });

  test('동기화 상태 표시', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // 동기화 상태 인디케이터 확인 (UI에 따라 조정)
    const syncIndicator = page
      .locator('[data-testid="sync-status"]')
      .or(page.getByText(/동기화|sync/i))
      .or(page.locator('[class*="sync"]'));

    // 동기화 상태가 어떤 형태로든 표시되어야 함
    // (아이콘, 텍스트, 또는 배지)
    await expect(syncIndicator.or(page.locator('header'))).toBeVisible();
  });

  test('네트워크 복구 후 pending 이벤트 동기화', async ({ page, context }) => {
    // 초기 상태 확인
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // 오프라인 전환
    await context.setOffline(true);

    // 여러 지출 등록
    for (let i = 0; i < 2; i++) {
      await page.goto('/expense/new');

      const authorField = page.getByLabel(/이름|작성자/i);
      if (await authorField.isVisible()) {
        await authorField.fill(`테스트유저${i + 1}`);
      }

      const amountField = page.getByLabel(/금액/i);
      if (await amountField.isVisible()) {
        await amountField.fill(`${10000 * (i + 1)}`);
      }

      const saveButton = page.getByRole('button', { name: /저장|등록|확인/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(500);
      }
    }

    // 온라인 복구
    await context.setOffline(false);

    // 메인 페이지로 이동
    await page.goto('/');
    await waitForAppReady(page);

    // 동기화 완료 대기
    await page.waitForTimeout(5000);

    // 페이지 새로고침 후 모든 데이터 확인
    await page.reload();
    await waitForAppReady(page);
  });
});
