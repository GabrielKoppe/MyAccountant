-- CreateIndex
CREATE INDEX "transaction_tags_tag_id_idx" ON "transaction_tags"("tag_id");

-- CreateIndex
CREATE INDEX "transactions_installment_group_id_idx" ON "transactions"("installment_group_id");
