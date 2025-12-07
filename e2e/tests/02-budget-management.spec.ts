import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  setDefaultMonthlyBudget,
  openSettingsPage,
  closeSettingsPage,
  waitForBudgetSync,
  getCurrentMonthBudget,
  getMonthlyEvents,
  getCurrentYearMonth,
} from '../utils/helpers';

test.describe('월별 예산 관리 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setInitialBudget(1000000);
    await setDefaultMonthlyBudget(500000);
    await page.goto('/');
    await waitForBudgetSync(page);
  });

  test('TC-002-1: 페이지 로딩 시 월 예산 자동 반영', async ({ page }) => {
    // 페이지 로딩 후 자동으로 예산이 반영되어야 함
    await page.waitForTimeout(3000);

    // 메인 페이지에서 예산 확인
    const balanceText = await page.locator('[data-testid="total-budget"]').textContent();
    expect(balanceText).toContain('500,000');

    // 백엔드 확인
    const budget = await getCurrentMonthBudget();
    expect(budget.totalBudget).toBe(500000);

    const { year, month } = getCurrentYearMonth();
    const events = await getMonthlyEvents(year, month);
    const monthlyBudgetEvent = events.find(
      (e: { description: string }) => e.description === '기본 월별 예산'
    );
    expect(monthlyBudgetEvent).toBeDefined();
    expect(monthlyBudgetEvent.eventType).toBe('BUDGET_IN');
    expect(monthlyBudgetEvent.amount).toBe(500000);

    // 페이지 새로고침 후 중복 생성 안됨 확인
    await page.reload();
    await waitForBudgetSync(page);

    const eventsAfterReload = await getMonthlyEvents(year, month);
    const budgetEvents = eventsAfterReload.filter(
      (e: { description: string }) => e.description === '기본 월별 예산'
    );
    expect(budgetEvents.length).toBe(1);
  });

  test('TC-002-2: 예산 조정 기능', async ({ page }) => {
    // 페이지 로딩 대기
    await page.waitForTimeout(2000);

    await openSettingsPage(page);

    // 현재 예산 확인
    await expect(page.locator('text=₩500,000')).toBeVisible();

    // 조정 버튼 클릭
    await page.click('button:has-text("조정")');
    await page.waitForSelector('input[placeholder*="목표"]', { timeout: 5000 });

    // 목표 잔액 입력
    await page.fill('input[placeholder*="목표"]', '700000');

    // 조정 내용 입력
    await page.fill('input[placeholder*="조정 내용"]', '추가 예산 지원');

    // 조정 버튼 클릭
    await page.click('button:has-text("조정")');

    // 성공 알림 확인
    await expect(page.locator('text=이번달 예산이 조정되었습니다')).toBeVisible({ timeout: 5000 });

    await closeSettingsPage(page);
    await waitForBudgetSync(page);

    // 메인 페이지에서 예산 확인
    await expect(page.locator('text=₩700,000')).toBeVisible({ timeout: 10000 });

    // 백엔드 확인
    const budget = await getCurrentMonthBudget();
    expect(budget.totalBudget).toBe(700000);
    expect(budget.balance).toBe(700000);
  });

  test('TC-002-3: 중복 조정 내용 방지', async ({ page }) => {
    // 첫 번째 조정
    await page.waitForTimeout(3000);
    await openSettingsPage(page);

    await page.click('[data-testid="adjust-budget-button"]');
    await page.waitForSelector('[data-testid="target-balance-input"]', {
      timeout: 5000,
    });

    await page.fill('[data-testid="target-balance-input"]', '700000');
    await page.fill('[data-testid="adjust-description-input"]', '추가 예산 지원');
    await page.click('[data-testid="save-adjust-button"]');

    await page.waitForTimeout(2000);

    // 두 번째 조정 시도 (같은 내용)
    await page.click('[data-testid="adjust-budget-button"]');
    await page.waitForSelector('[data-testid="target-balance-input"]', {
      timeout: 5000,
    });

    await page.fill('[data-testid="target-balance-input"]', '800000');
    await page.fill('[data-testid="adjust-description-input"]', '추가 예산 지원');

    // 에러 다이얼로그 기대
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('이미');
      expect(dialog.message()).toContain('추가 예산 지원');
      await dialog.accept();
    });

    await page.click('[data-testid="save-adjust-button"]');
    await page.waitForTimeout(1000);

    // 예산이 변경되지 않았는지 확인
    const budget = await getCurrentMonthBudget();
    expect(budget.totalBudget).toBe(700000);
  });
});
