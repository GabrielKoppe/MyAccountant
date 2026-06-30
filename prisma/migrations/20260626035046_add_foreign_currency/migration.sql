-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "exchange_rate" DECIMAL(18,6),
ADD COLUMN     "original_amount_cents" BIGINT,
ADD COLUMN     "original_currency" TEXT;
