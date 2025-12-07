/*
  Warnings:

  - A unique constraint covering the columns `[year,month,eventType,authorName,description]` on the table `budget_events` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "budget_events_year_month_eventType_authorName_description_key" ON "budget_events"("year", "month", "eventType", "authorName", "description");
