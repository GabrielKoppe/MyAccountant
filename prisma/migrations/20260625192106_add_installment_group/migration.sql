-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "installment_group_id" TEXT,
ADD COLUMN     "installment_number" INTEGER;

-- CreateTable
CREATE TABLE "installment_groups" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_cents" BIGINT NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "down_payment_cents" BIGINT,
    "start_date" DATE NOT NULL,
    "section_id" TEXT NOT NULL,
    "table_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installment_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_installments" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "installment_group_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "expected_date" DATE NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installment_groups_account_id_idx" ON "installment_groups"("account_id");

-- CreateIndex
CREATE INDEX "pending_installments_account_id_idx" ON "pending_installments"("account_id");

-- CreateIndex
CREATE INDEX "pending_installments_installment_group_id_idx" ON "pending_installments"("installment_group_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_group_id_fkey" FOREIGN KEY ("installment_group_id") REFERENCES "installment_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_groups" ADD CONSTRAINT "installment_groups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_groups" ADD CONSTRAINT "installment_groups_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_groups" ADD CONSTRAINT "installment_groups_table_type_id_fkey" FOREIGN KEY ("table_type_id") REFERENCES "table_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_installments" ADD CONSTRAINT "pending_installments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_installments" ADD CONSTRAINT "pending_installments_installment_group_id_fkey" FOREIGN KEY ("installment_group_id") REFERENCES "installment_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
