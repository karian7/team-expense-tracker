-- AlterTable
ALTER TABLE "budget_events" ADD COLUMN "referenceSequence" INTEGER;

-- CreateIndex
CREATE INDEX "budget_events_referenceSequence_idx" ON "budget_events"("referenceSequence");
