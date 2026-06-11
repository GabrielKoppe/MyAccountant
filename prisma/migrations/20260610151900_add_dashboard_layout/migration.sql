-- CreateEnum
CREATE TYPE "dashboard_layout_context" AS ENUM ('monthly', 'yearly', 'month_summary');

-- CreateTable
CREATE TABLE "dashboard_layouts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "context" "dashboard_layout_context" NOT NULL,
    "widgets" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_layouts_account_id_idx" ON "dashboard_layouts"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_layouts_account_id_context_key" ON "dashboard_layouts"("account_id", "context");

-- AddForeignKey
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
