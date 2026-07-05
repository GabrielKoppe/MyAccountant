-- AlterTable
ALTER TABLE "checklist_completions" ADD COLUMN     "transaction_id" TEXT;

-- CreateIndex
CREATE INDEX "checklist_completions_transaction_id_idx" ON "checklist_completions"("transaction_id");

-- AddForeignKey
ALTER TABLE "checklist_completions" ADD CONSTRAINT "checklist_completions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
