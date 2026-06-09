-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT,
    "section_id" TEXT,
    "category_id" TEXT,
    "member_user_id" TEXT,
    "institution_id" TEXT,
    "table_type_id" TEXT,
    "amount_cents" BIGINT NOT NULL,
    "alert_threshold_percent" INTEGER NOT NULL DEFAULT 80,
    "is_recurring" BOOLEAN NOT NULL DEFAULT true,
    "show_in_summary" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER,
    "month" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budgets_account_id_idx" ON "budgets"("account_id");

-- CreateIndex
CREATE INDEX "budgets_account_id_is_recurring_idx" ON "budgets"("account_id", "is_recurring");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_member_user_id_fkey" FOREIGN KEY ("member_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_table_type_id_fkey" FOREIGN KEY ("table_type_id") REFERENCES "table_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
