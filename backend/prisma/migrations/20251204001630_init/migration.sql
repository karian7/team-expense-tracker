-- CreateTable
CREATE TABLE "monthly_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "baseAmount" DECIMAL NOT NULL DEFAULT 0,
    "carriedAmount" DECIMAL NOT NULL DEFAULT 0,
    "totalBudget" DECIMAL NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL NOT NULL DEFAULT 0,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monthlyBudgetId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "expenseDate" DATETIME NOT NULL,
    "storeName" TEXT,
    "receiptImageUrl" TEXT NOT NULL,
    "ocrRawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "expenses_monthlyBudgetId_fkey" FOREIGN KEY ("monthlyBudgetId") REFERENCES "monthly_budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_budgets_year_month_key" ON "monthly_budgets"("year", "month");

-- CreateIndex
CREATE INDEX "expenses_monthlyBudgetId_idx" ON "expenses"("monthlyBudgetId");

-- CreateIndex
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");

-- CreateIndex
CREATE INDEX "expenses_authorName_idx" ON "expenses"("authorName");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
