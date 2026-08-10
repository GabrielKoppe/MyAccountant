-- CreateEnum
CREATE TYPE "settings_status" AS ENUM ('active', 'inactive');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "csv_templates" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "institutions" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "responsible_parties" ADD COLUMN     "last_used_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "last_used_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subcategories" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "table_templates" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "table_types" ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "status" "settings_status" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "transaction_aliases" ADD COLUMN     "last_used_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "usage_counts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "transactions" INTEGER NOT NULL DEFAULT 0,
    "months" INTEGER NOT NULL DEFAULT 0,
    "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_counts_account_id_idx" ON "usage_counts"("account_id");

-- CreateIndex
CREATE INDEX "usage_counts_counted_at_idx" ON "usage_counts"("counted_at");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counts_account_id_entity_entity_id_key" ON "usage_counts"("account_id", "entity", "entity_id");

-- AddForeignKey
ALTER TABLE "usage_counts" ADD CONSTRAINT "usage_counts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
