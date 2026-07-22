-- CreateEnum
CREATE TYPE "categorization_match_mode" AS ENUM ('contains', 'regex');

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "apply_to_manual" BOOLEAN NOT NULL DEFAULT false,
    "stop_on_match" BOOLEAN NOT NULL DEFAULT true,
    "description_mode" "categorization_match_mode",
    "description_value" TEXT,
    "condition_institution_id" TEXT,
    "min_cents" BIGINT,
    "max_cents" BIGINT,
    "set_description" TEXT,
    "set_notes" TEXT,
    "set_category_id" TEXT,
    "set_subcategory_id" TEXT,
    "set_institution_id" TEXT,
    "set_institution_text" TEXT,
    "set_responsible_party_id" TEXT,
    "set_expense_type" "transaction_expense_type",
    "set_payment_method" "transaction_payment_method",
    "set_investment_type" TEXT,
    "set_card_installment" TEXT,
    "set_is_pending" BOOLEAN,
    "set_is_favorite" BOOLEAN,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorization_rule_tags" (
    "rule_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "categorization_rule_tags_pkey" PRIMARY KEY ("rule_id","tag_id")
);

-- CreateIndex
CREATE INDEX "categorization_rules_account_id_idx" ON "categorization_rules"("account_id");

-- CreateIndex
CREATE INDEX "categorization_rules_account_id_is_active_priority_idx" ON "categorization_rules"("account_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "categorization_rule_tags_tag_id_idx" ON "categorization_rule_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_condition_institution_id_fkey" FOREIGN KEY ("condition_institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_set_category_id_fkey" FOREIGN KEY ("set_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_set_subcategory_id_fkey" FOREIGN KEY ("set_subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_set_institution_id_fkey" FOREIGN KEY ("set_institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_set_responsible_party_id_fkey" FOREIGN KEY ("set_responsible_party_id") REFERENCES "responsible_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rule_tags" ADD CONSTRAINT "categorization_rule_tags_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "categorization_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rule_tags" ADD CONSTRAINT "categorization_rule_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
