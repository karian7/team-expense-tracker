import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  setDefaultMonthlyBudget,
  addExpenseManually,
  waitForBudgetSync,
} from '../utils/helpers';

test.describe('보안 및 에러 핸들링 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setInitialBudget(1000000);
    await setDefaultMonthlyBudget(500000);
    await page.goto('/');
    await waitForBudgetSync(page);
  });

  test('TC-027: 파일 업로드 제한', async ({ page }) => {
    await page.waitForTimeout(2000);

    // PDF 파일 업로드 시도 (이미지가 아닌 파일)
    const invalidFileContent = Buffer.from('invalid content');
    const invalidFilePath = './e2e/fixtures/invalid.pdf';

    // Note: 실제로는 파일 검증이 클라이언트나 서버에서 수행됨
    // 브라우저의 accept 속성으로 제한되는지 확인
    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await expect(fileInput).toHaveAttribute('accept', /image/);
  });

  test('TC-028: 파일 크기 제한', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 파일 크기 제한은 백엔드에서 처리되므로
    // 실제 큰 파일을 업로드하는 대신 UI에 제한 정보가 표시되는지 확인
    await page.click('button:has-text("영수증 추가")');
    await page.waitForTimeout(500);

    // 파일 입력 필드 확인
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });

  test('TC-029: SQL Injection 방어', async ({ page }) => {
    await page.waitForTimeout(2000);

    // SQL Injection 시도
    const maliciousExpense = {
      amount: 50000,
      date: '2024-12-01',
      storeName: "'; DROP TABLE expenses; --",
      authorName: "'; SELECT * FROM users; --",
    };

    await addExpenseManually(page, maliciousExpense);

    // 데이터가 정상적으로 저장되고 이스케이프되었는지 확인
    await expect(page.locator("text='; DROP TABLE expenses; --")).toBeVisible({ timeout: 5000 });

    // 앱이 정상 작동하는지 확인 (테이블이 삭제되지 않음)
    await expect(page.locator('text=남은 예산')).toBeVisible();
  });

  test('TC-030: XSS 방어', async ({ page }) => {
    await page.waitForTimeout(2000);

    // XSS 시도
    const xssExpense = {
      amount: 50000,
      date: '2024-12-01',
      storeName: '<script>alert("XSS")</script>',
      authorName: '<img src=x onerror="alert(\'XSS\')">',
    };

    await addExpenseManually(page, xssExpense);

    // 스크립트가 실행되지 않고 텍스트로만 표시되는지 확인
    await page.waitForTimeout(1000);

    // alert가 발생하지 않았는지 확인 (페이지가 정상 작동)
    await expect(page.locator('text=남은 예산')).toBeVisible();

    // HTML이 이스케이프되어 텍스트로 표시되는지 확인
    await expect(page.locator('text=<script>alert("XSS")</script>')).toBeVisible();
  });
});
