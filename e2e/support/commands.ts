import { Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page): Promise<void> {
  // 앱이 로드될 때까지 대기
  await page.waitForLoadState('networkidle');
}

export async function navigateToExpenseForm(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  // 지출 등록 버튼 클릭 (UI에 따라 조정 필요)
  const addButton = page.getByRole('button', { name: /지출|등록|추가/i });
  if (await addButton.isVisible()) {
    await addButton.click();
  }
}

export async function fillExpenseForm(
  page: Page,
  data: {
    authorName: string;
    amount: number;
    storeName?: string;
    description?: string;
  }
): Promise<void> {
  // 폼 필드 채우기 (UI에 따라 조정 필요)
  await page.getByLabel(/이름|작성자/i).fill(data.authorName);
  await page.getByLabel(/금액/i).fill(data.amount.toString());

  if (data.storeName) {
    await page.getByLabel(/가게|상호/i).fill(data.storeName);
  }

  if (data.description) {
    await page.getByLabel(/설명|메모/i).fill(data.description);
  }
}

export async function submitExpenseForm(page: Page): Promise<void> {
  const submitButton = page.getByRole('button', { name: /저장|등록|확인/i });
  await submitButton.click();
}

export async function expectToast(page: Page, message: string | RegExp): Promise<void> {
  const toast = page.getByRole('alert').or(page.locator('[class*="toast"]'));
  await expect(toast).toContainText(message);
}

export async function clearIndexedDB(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map((db) => {
        if (db.name) {
          return new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(db.name!);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
        return Promise.resolve();
      })
    );
  });
}

export async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

export async function setLocalStorageItem(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: value });
}
