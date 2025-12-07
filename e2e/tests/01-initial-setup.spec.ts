import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  openSettingsPage,
  closeSettingsPage,
  waitForBudgetSync,
} from '../utils/helpers';

test.describe('초기 설정 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await page.goto('/');
    await waitForBudgetSync(page);
  });

  test('TC-001: 초기 예산 설정', async ({ page }) => {
    // 설정 페이지 열기
    await openSettingsPage(page);

    // 초기화 버튼 클릭
    await page.click('[data-testid="reset-all-data-button"]');

    // 모달이 열림
    await page.waitForSelector('[data-testid="initial-budget-input"]', {
      timeout: 5000,
    });

    // 초기 예산 입력
    await page.fill('[data-testid="initial-budget-input"]', '1000000');

    // 확인 다이얼로그 처리
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('정말로');
      dialog.accept();
    });

    // 확인 버튼 클릭
    await page.click('[data-testid="confirm-reset-button"]');

    await page.waitForTimeout(2000);

    await closeSettingsPage(page);
    await waitForBudgetSync(page);

    // 초기 상태 확인 (아직 월 예산 생성 안됨)
    await expect(page.locator('[data-testid="current-balance"]')).toBeVisible();
  });

  test('TC-002: 기본 월별 예산 설정', async ({ page }) => {
    await setInitialBudget(1000000);
    await page.reload();
    await waitForBudgetSync(page);

    await openSettingsPage(page);

    // 월 예산 변경 버튼 클릭
    await page.click('[data-testid="change-monthly-budget-button"]');

    // 모달이 열림
    await page.waitForSelector('[data-testid="monthly-budget-input"]', {
      timeout: 5000,
    });

    // 월별 기본 예산 입력
    await page.fill('[data-testid="monthly-budget-input"]', '500000');

    // 설정 저장
    await page.click('[data-testid="save-budget-button"]');

    await page.waitForTimeout(2000);

    await closeSettingsPage(page);
  });
});
