-- AlterTable
ALTER TABLE "installment_groups" ADD COLUMN     "auto_create_on_new_month" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "pending_installments" ADD COLUMN     "settled_at" TIMESTAMP(3);
