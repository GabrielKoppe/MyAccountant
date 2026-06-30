-- CreateEnum
CREATE TYPE "transaction_source" AS ENUM ('manual', 'csv_import', 'xlsx_import', 'template', 'auto_template', 'duplicate');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "source" "transaction_source" NOT NULL DEFAULT 'manual';
