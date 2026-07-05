-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_completions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "month_id" TEXT NOT NULL,
    "completed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checklist_items_account_id_idx" ON "checklist_items"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_account_id_label_key" ON "checklist_items"("account_id", "label");

-- CreateIndex
CREATE INDEX "checklist_completions_account_id_idx" ON "checklist_completions"("account_id");

-- CreateIndex
CREATE INDEX "checklist_completions_month_id_idx" ON "checklist_completions"("month_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_completions_item_id_month_id_key" ON "checklist_completions"("item_id", "month_id");

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_completions" ADD CONSTRAINT "checklist_completions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_completions" ADD CONSTRAINT "checklist_completions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_completions" ADD CONSTRAINT "checklist_completions_month_id_fkey" FOREIGN KEY ("month_id") REFERENCES "months"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_completions" ADD CONSTRAINT "checklist_completions_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
