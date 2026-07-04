-- CreateEnum
CREATE TYPE "transaction_payment_method" AS ENUM ('pix', 'cash', 'credit_card', 'debit_card', 'bank_transfer', 'boleto', 'other');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "payment_method" "transaction_payment_method";
