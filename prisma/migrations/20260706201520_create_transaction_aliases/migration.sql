-- CreateTable
CREATE TABLE "transaction_aliases" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "trigger_text" TEXT NOT NULL,
    "trigger_normalized" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "amount_cents" BIGINT,
    "category_id" TEXT,
    "subcategory_id" TEXT,
    "institution_id" TEXT,
    "institution_text" TEXT,
    "responsible_party_id" TEXT,
    "expense_type" "transaction_expense_type",
    "payment_method" "transaction_payment_method",
    "investment_type" TEXT,
    "card_installment" TEXT,
    "is_pending" BOOLEAN,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_alias_tags" (
    "alias_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "transaction_alias_tags_pkey" PRIMARY KEY ("alias_id","tag_id")
);

-- CreateIndex
CREATE INDEX "transaction_aliases_account_id_idx" ON "transaction_aliases"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_aliases_account_id_trigger_normalized_key" ON "transaction_aliases"("account_id", "trigger_normalized");

-- CreateIndex
CREATE INDEX "transaction_alias_tags_tag_id_idx" ON "transaction_alias_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_responsible_party_id_fkey" FOREIGN KEY ("responsible_party_id") REFERENCES "responsible_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_alias_tags" ADD CONSTRAINT "transaction_alias_tags_alias_id_fkey" FOREIGN KEY ("alias_id") REFERENCES "transaction_aliases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_alias_tags" ADD CONSTRAINT "transaction_alias_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
