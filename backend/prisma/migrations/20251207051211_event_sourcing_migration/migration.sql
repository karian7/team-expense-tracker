/*
  Warnings:

  - You are about to drop the `expenses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `monthly_budgets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "expenses";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "monthly_budgets";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "budget_events" (
    "sequence" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "authorName" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "storeName" TEXT,
    "description" TEXT,
    "receiptImage" BLOB,
    "ocrRawData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "budget_events_year_month_idx" ON "budget_events"("year", "month");

-- CreateIndex
CREATE INDEX "budget_events_eventDate_idx" ON "budget_events"("eventDate");

-- CreateIndex
CREATE INDEX "budget_events_authorName_idx" ON "budget_events"("authorName");
