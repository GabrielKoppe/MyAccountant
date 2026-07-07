-- AlterTable
ALTER TABLE "transaction_aliases" ADD COLUMN     "exchange_rate" DECIMAL(18,6),
ADD COLUMN     "is_favorite" BOOLEAN,
ADD COLUMN     "original_amount_cents" BIGINT,
ADD COLUMN     "original_currency" TEXT;
