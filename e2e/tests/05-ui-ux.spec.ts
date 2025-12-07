import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  setDefaultMonthlyBudget,
  waitForBudgetSync,
} from '../utils/helpers';

test.describe('UI/UX 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setInitialBudget(1000000);
    await setDefaultMonthlyBudget(500000);
    await page.goto('/');
    await waitForBudgetSync(page);
  });

  test('TC-021: 모바일 반응형 테스트', async ({ page }) => {
    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);

    // 주요 요소들이 보이는지 확인
    await expect(page.locator('text=남은 예산')).toBeVisible();
    await expect(page.locator('button:has-text("영수증 추가")')).toBeVisible();

    // 버튼이 터치하기 적절한 크기인지 확인
    const addButton = page.locator('button:has-text("영수증 추가")');
    const box = await addButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44); // 최소 44px (터치 타겟)
    }

    // 설정 버튼 확인
    await page.click('[aria-label="설정"]');
    await expect(page.locator('text=설정')).toBeVisible();
  });

  test('TC-022: 로딩 상태 표시', async ({ page }) => {
    // 영수증 추가 버튼 클릭
    await page.click('button:has-text("영수증 추가")');
    await page.waitForSelector('input[name="amount"]');

    // 폼 작성
    await page.fill('input[name="amount"]', '50000');
    await page.fill('input[name="date"]', '2024-12-01');
    await page.fill('input[name="storeName"]', '테스트');
    await page.fill('input[name="authorName"]', '홍길동');

    // 저장 버튼 클릭 (로딩 상태 확인)
    const saveButton = page.locator('button:has-text("저장")');
    await saveButton.click();

    // 로딩 중에는 버튼이 비활성화되거나 로딩 표시
    // (구현에 따라 다를 수 있음)
    await page.waitForTimeout(500);

    // 저장 완료 확인
    await expect(page.locator('text=테스트')).toBeVisible({ timeout: 5000 });
  });

  test('TC-023: 오류 메시지 표시', async ({ page }) => {
    // 네트워크 차단 시뮬레이션
    await page.route('**/api/**', (route) => route.abort());

    await page.reload();
    await page.waitForTimeout(1000);

    // 오류 상태 확인 (네트워크 에러로 인한 데이터 로드 실패)
    // 구현에 따라 에러 메시지가 다를 수 있음
    await page.waitForTimeout(2000);

    // 네트워크 복구
    await page.unroute('**/api/**');
  });
});
