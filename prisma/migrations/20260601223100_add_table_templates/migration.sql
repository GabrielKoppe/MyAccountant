-- AlterEnum
ALTER TYPE "table_source_method" ADD VALUE 'template';

-- CreateTable
CREATE TABLE "table_templates" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "table_type_id" TEXT,
    "count_in_month" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "is_pending" BOOLEAN NOT NULL DEFAULT false,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "institution_id" TEXT,
    "responsible_user_id" TEXT,
    "card_installment" TEXT,
    "investment_type" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "table_templates_account_id_idx" ON "table_templates"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "table_templates_account_id_name_key" ON "table_templates"("account_id", "name");

-- CreateIndex
CREATE INDEX "table_template_items_template_id_idx" ON "table_template_items"("template_id");

-- AddForeignKey
ALTER TABLE "table_templates" ADD CONSTRAINT "table_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_templates" ADD CONSTRAINT "table_templates_table_type_id_fkey" FOREIGN KEY ("table_type_id") REFERENCES "table_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_templates" ADD CONSTRAINT "table_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_template_items" ADD CONSTRAINT "table_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "table_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_template_items" ADD CONSTRAINT "table_template_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
