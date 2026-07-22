-- AlterTable
ALTER TABLE "account_settings" ADD COLUMN     "forecast_conservative_pct" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "forecast_horizon_months" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "forecast_optimistic_pct" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "forecast_scenario" TEXT NOT NULL DEFAULT 'realistic',
ADD COLUMN     "forecast_start_balance_cents" BIGINT,
ADD COLUMN     "forecast_variable_window" INTEGER NOT NULL DEFAULT 6;
