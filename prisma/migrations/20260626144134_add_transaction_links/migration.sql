-- CreateEnum
CREATE TYPE "transaction_link_type" AS ENUM ('reimbursed_by', 'paid_for', 'relates_to');

-- CreateTable
CREATE TABLE "transaction_links" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "type" "transaction_link_type" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_links_source_id_idx" ON "transaction_links"("source_id");

-- CreateIndex
CREATE INDEX "transaction_links_target_id_idx" ON "transaction_links"("target_id");

-- CreateIndex
CREATE INDEX "transaction_links_account_id_idx" ON "transaction_links"("account_id");

-- AddForeignKey
ALTER TABLE "transaction_links" ADD CONSTRAINT "transaction_links_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_links" ADD CONSTRAINT "transaction_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_links" ADD CONSTRAINT "transaction_links_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
