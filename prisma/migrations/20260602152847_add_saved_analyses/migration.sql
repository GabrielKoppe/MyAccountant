-- CreateTable
CREATE TABLE "saved_analyses" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinned_order" INTEGER NOT NULL DEFAULT 0,
    "dashboard_context" TEXT NOT NULL DEFAULT 'yearly',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_analyses_account_id_idx" ON "saved_analyses"("account_id");

-- CreateIndex
CREATE INDEX "saved_analyses_account_id_is_pinned_idx" ON "saved_analyses"("account_id", "is_pinned");

-- CreateIndex
CREATE UNIQUE INDEX "saved_analyses_account_id_name_key" ON "saved_analyses"("account_id", "name");

-- AddForeignKey
ALTER TABLE "saved_analyses" ADD CONSTRAINT "saved_analyses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_analyses" ADD CONSTRAINT "saved_analyses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
