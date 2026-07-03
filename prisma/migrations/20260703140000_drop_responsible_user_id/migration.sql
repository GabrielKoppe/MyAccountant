-- Spec 60 Fase 5: remove a coluna legada responsibleUserId (substituída por responsiblePartyId).
-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_responsible_user_id_fkey";
-- AlterTable
ALTER TABLE "account_settings" DROP COLUMN "default_responsible_user_id";
-- AlterTable
ALTER TABLE "table_template_items" DROP COLUMN "responsible_user_id";
-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "responsible_user_id";
