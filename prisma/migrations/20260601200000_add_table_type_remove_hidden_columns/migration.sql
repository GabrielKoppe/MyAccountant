-- CreateTable
CREATE TABLE IF NOT EXISTS "table_types" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "hidden_columns" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "table_types_account_id_name_key" ON "table_types"("account_id", "name");

-- AddForeignKey
ALTER TABLE "table_types" ADD CONSTRAINT "table_types_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: remove table_type column, add table_type_id FK
ALTER TABLE "finance_tables" DROP COLUMN IF EXISTS "table_type";
ALTER TABLE "finance_tables" ADD COLUMN IF NOT EXISTS "table_type_id" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "finance_tables" ADD CONSTRAINT "finance_tables_table_type_id_fkey" FOREIGN KEY ("table_type_id") REFERENCES "table_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: remove hidden_columns from account_settings
ALTER TABLE "account_settings" DROP COLUMN IF EXISTS "hidden_columns";
