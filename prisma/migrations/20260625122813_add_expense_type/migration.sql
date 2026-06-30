-- CreateEnum
CREATE TYPE "transaction_expense_type" AS ENUM ('fixed', 'variable', 'one_time');

-- AlterTable
ALTER TABLE "table_template_items" ADD COLUMN     "expense_type" "transaction_expense_type";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "expense_type" "transaction_expense_type";
