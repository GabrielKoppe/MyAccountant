-- CreateEnum
CREATE TYPE "balance_account_kind" AS ENUM ('asset', 'liability');

-- CreateTable
CREATE TABLE "balance_accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "kind" "balance_account_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "institution_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "balance_account_id" TEXT NOT NULL,
    "balance_cents" BIGINT NOT NULL,
    "captured_on" DATE NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "balance_accounts_account_id_idx" ON "balance_accounts"("account_id");

-- CreateIndex
CREATE INDEX "balance_accounts_account_id_kind_idx" ON "balance_accounts"("account_id", "kind");

-- CreateIndex
CREATE INDEX "balance_snapshots_account_id_idx" ON "balance_snapshots"("account_id");

-- CreateIndex
CREATE INDEX "balance_snapshots_balance_account_id_captured_on_idx" ON "balance_snapshots"("balance_account_id", "captured_on");

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshots_balance_account_id_captured_on_key" ON "balance_snapshots"("balance_account_id", "captured_on");

-- AddForeignKey
ALTER TABLE "balance_accounts" ADD CONSTRAINT "balance_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_accounts" ADD CONSTRAINT "balance_accounts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_balance_account_id_fkey" FOREIGN KEY ("balance_account_id") REFERENCES "balance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
