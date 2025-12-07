import { Page, expect } from '@playwright/test';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = 'http://localhost:3001/api';

export async function resetDatabase() {
  try {
    await axios.delete(`${API_URL}/settings/reset`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.log('Reset error:', error);
  }
}

export async function setInitialBudget(amount: number) {
  await axios.post(`${API_URL}/settings/initial-budget`, {
    initialBudget: amount,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export async function setDefaultMonthlyBudget(amount: number) {
  await axios.put(`${API_URL}/settings`, {
    defaultMonthlyBudget: amount,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export async function waitForBudgetSync(page: Page) {
  await page.waitForTimeout(1000);
}

export async function openSettingsPage(page: Page) {
  await page.click('[data-testid="settings-button"]');
  await page.waitForSelector('text=설정', { timeout: 5000 });
}

export async function closeSettingsPage(page: Page) {
  await page.click('[data-testid="settings-close-button"]');
  await page.waitForTimeout(500);
}

export async function createCSVFile(filename: string, content: string): Promise<string> {
  const filepath = path.join(process.cwd(), 'e2e', 'fixtures', filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  return filepath;
}

export async function expectBudgetAmount(page: Page, expectedAmount: number | string) {
  const formattedAmount =
    typeof expectedAmount === 'number'
      ? `₩${expectedAmount.toLocaleString('ko-KR')}`
      : expectedAmount;
  await expect(page.locator(`text=${formattedAmount}`).first()).toBeVisible();
}

export async function addExpenseManually(
  page: Page,
  expense: {
    amount: number;
    date: string;
    storeName: string;
    authorName: string;
  }
) {
  // Navigate to add expense
  await page.click('[data-testid="add-expense-button"]');
  await page.waitForSelector('[data-testid="expense-amount-input"]', {
    timeout: 5000,
  });

  // Fill form
  await page.fill('[data-testid="expense-amount-input"]', expense.amount.toString());
  await page.fill('[data-testid="expense-date-input"]', expense.date);
  await page.fill('[data-testid="expense-storename-input"]', expense.storeName);
  await page.fill('[data-testid="expense-author-input"]', expense.authorName);

  // Submit
  await page.click('[data-testid="save-expense-button"]');
  await page.waitForTimeout(1000);
}

export async function getCurrentMonthBudget() {
  const response = await axios.get(`${API_URL}/monthly-budgets/current`);
  return response.data.data;
}

export async function getMonthlyEvents(year: number, month: number) {
  const response = await axios.get(`${API_URL}/events/month/${year}/${month}`);
  return response.data.data;
}

export function getCurrentYearMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}
