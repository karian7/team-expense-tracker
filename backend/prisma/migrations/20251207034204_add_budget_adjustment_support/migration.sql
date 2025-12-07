-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyBudgetId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "expenseDate" DATETIME NOT NULL,
    "storeName" TEXT,
    "receiptImageUrl" TEXT,
    "description" TEXT,
    "ocrRawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "expenses_monthlyBudgetId_fkey" FOREIGN KEY ("monthlyBudgetId") REFERENCES "monthly_budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_expenses" ("amount", "authorName", "createdAt", "expenseDate", "id", "monthlyBudgetId", "ocrRawData", "receiptImageUrl", "storeName", "updatedAt") SELECT "amount", "authorName", "createdAt", "expenseDate", "id", "monthlyBudgetId", "ocrRawData", "receiptImageUrl", "storeName", "updatedAt" FROM "expenses";
DROP TABLE "expenses";
ALTER TABLE "new_expenses" RENAME TO "expenses";
CREATE INDEX "expenses_monthlyBudgetId_idx" ON "expenses"("monthlyBudgetId");
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");
CREATE INDEX "expenses_authorName_idx" ON "expenses"("authorName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
