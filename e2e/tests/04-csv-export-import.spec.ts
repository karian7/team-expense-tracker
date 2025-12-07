import { test, expect } from '@playwright/test';
import {
  resetDatabase,
  setInitialBudget,
  setDefaultMonthlyBudget,
  addExpenseManually,
  openSettingsPage,
  closeSettingsPage,
  waitForBudgetSync,
  createCSVFile,
} from '../utils/helpers';
import { TEST_DATA } from '../fixtures/test-data';
import * as fs from 'fs';
import * as path from 'path';

test.describe('CSV Export/Import 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await setInitialBudget(1000000);
    await setDefaultMonthlyBudget(500000);
    await page.goto('/');
    await waitForBudgetSync(page);
  });

  test('TC-013: CSV Export (백업)', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 사용 내역 추가
    for (const expense of TEST_DATA.expenses) {
      await addExpenseManually(page, expense);
      await page.waitForTimeout(500);
    }

    await openSettingsPage(page);

    // 다운로드 이벤트 대기
    const downloadPromise = page.waitForEvent('download');

    // 백업 다운로드 버튼 클릭
    await page.click('[data-testid="export-csv-button"]');

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // 파일명 확인
    expect(filename).toMatch(/expenses_\d{4}-\d{2}-\d{2}\.csv/);

    // 파일 내용 확인
    const filepath = path.join(process.cwd(), 'e2e', 'fixtures', 'downloaded.csv');
    await download.saveAs(filepath);

    const content = fs.readFileSync(filepath, 'utf-8');
    expect(content).toContain('ID,작성자,금액,사용날짜,상호명');
    expect(content).toContain('홍길동');
    expect(content).toContain('김철수');
    expect(content).toContain('이영희');

    // 정리
    fs.unlinkSync(filepath);

    await closeSettingsPage(page);
  });

  test('TC-014: CSV Import (복원) - 새 데이터 추가', async ({ page }) => {
    await page.waitForTimeout(2000);

    await openSettingsPage(page);

    // CSV 파일 생성
    const csvPath = await createCSVFile('import-new.csv', TEST_DATA.csvData);

    // 파일 선택
    const fileInput = page.locator('[data-testid="import-csv-input"]');
    await fileInput.setInputFiles(csvPath);

    // 파일이 자동으로 처리됨 (onChange 이벤트)
    await page.waitForTimeout(2000);

    await closeSettingsPage(page);
    await waitForBudgetSync(page);

    // 새로운 내역 확인
    await expect(page.locator('text=테스트식당')).toBeVisible();
    await expect(page.locator('text=카페')).toBeVisible();

    // 정리
    fs.unlinkSync(csvPath);
  });

  test('TC-015: CSV Import (복원) - 기존 데이터 업데이트', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 초기 데이터 추가
    const expense = TEST_DATA.expenses[0];
    await addExpenseManually(page, expense);
    await page.waitForTimeout(1000);

    // 다운로드하여 ID 확인
    await openSettingsPage(page);
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("백업 다운로드")');
    const download = await downloadPromise;

    const downloadPath = path.join(process.cwd(), 'e2e', 'fixtures', 'backup.csv');
    await download.saveAs(downloadPath);

    let content = fs.readFileSync(downloadPath, 'utf-8');
    const lines = content.split('\n');

    // 금액 수정 (50000 → 60000)
    const updatedLines = lines.map((line) => {
      if (line.includes('50000')) {
        return line.replace('50000', '60000');
      }
      return line;
    });
    content = updatedLines.join('\n');

    const updatePath = await createCSVFile('import-update.csv', content);

    // 업데이트 파일 업로드
    await page.locator('input[type="file"]').setInputFiles(updatePath);
    await page.click('button:has-text("데이터 복원")');

    await expect(page.locator('text=복원 완료')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text=업데이트: 1')).toBeVisible();

    await closeSettingsPage(page);
    await waitForBudgetSync(page);

    // 변경된 금액 확인
    await expect(page.locator('text=₩60,000')).toBeVisible();

    // 정리
    fs.unlinkSync(downloadPath);
    fs.unlinkSync(updatePath);
  });

  test('TC-016: CSV Import - 오류 처리', async ({ page }) => {
    await page.waitForTimeout(2000);

    await openSettingsPage(page);

    // 잘못된 CSV 파일 생성
    const invalidCSV = `ID,작성자,금액,사용날짜,상호명
,홍길동,잘못된금액,2024-12-01,식당
,김철수,-5000,2024-12-02,카페`;

    const csvPath = await createCSVFile('import-invalid.csv', invalidCSV);

    // 파일 업로드
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await page.click('button:has-text("데이터 복원")');

    // 오류 메시지 확인
    await expect(page.locator('text=실패')).toBeVisible({ timeout: 10000 });

    // 정리
    fs.unlinkSync(csvPath);

    await closeSettingsPage(page);
  });

  test('TC-017: CSV 템플릿 다운로드', async ({ page }) => {
    await page.waitForTimeout(1000);

    await openSettingsPage(page);

    // 다운로드 이벤트 대기
    const downloadPromise = page.waitForEvent('download');

    // 템플릿 다운로드 버튼 클릭
    await page.click('[data-testid="download-template-button"]');

    const download = await downloadPromise;
    const filename = download.suggestedFilename();

    // 파일명 확인
    expect(filename).toBe('expense_import_template.csv');

    // 파일 내용 확인
    const filepath = path.join(process.cwd(), 'e2e', 'fixtures', 'template.csv');
    await download.saveAs(filepath);

    const content = fs.readFileSync(filepath, 'utf-8');
    expect(content).toContain('ID,작성자,금액,사용날짜,상호명');
    expect(content.split('\n').length).toBeGreaterThanOrEqual(2); // 헤더 + 예제

    // 정리
    fs.unlinkSync(filepath);

    await closeSettingsPage(page);
  });
});
