-- CreateEnum
CREATE TYPE "institution_kind" AS ENUM ('bank', 'card', 'broker', 'wallet', 'company');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "default_section_id" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "institutions" ADD COLUMN     "account_no" TEXT,
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "closing_day" INTEGER,
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "kind" "institution_kind",
ADD COLUMN     "last4" TEXT,
ADD COLUMN     "tax_id" TEXT;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "subcategories" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "usage_counts" ADD COLUMN     "by_month" JSONB;

-- CreateIndex
CREATE INDEX "categories_account_id_order_idx" ON "categories"("account_id", "order");

-- CreateIndex
CREATE INDEX "subcategories_category_id_order_idx" ON "subcategories"("category_id", "order");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_default_section_id_fkey" FOREIGN KEY ("default_section_id") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill (Spec 68 §7.1)
--
-- Só as duas colunas `order`. `sections.color`, `categories.default_section_id` e
-- `institutions.kind` ficam NULL de propósito: a escolha é do usuário e adivinhar
-- (cor por índice, seção por nome, "Nubank" = cartão) rotularia dado alheio.
--
-- A ordem manual inicial é a ordem ALFABÉTICA — exatamente a que o usuário já vê
-- nas listas hoje, então a migração não reordena nada na tela.
-- Toda linha nasceu com DEFAULT 0 no ADD COLUMN acima; estes UPDATEs apenas
-- desempatam. Nenhuma coluna preexistente é tocada.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "categories" AS c
SET "order" = ranked.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "account_id" ORDER BY "name" ASC) - 1) AS rn
  FROM "categories"
) AS ranked
WHERE c."id" = ranked."id";

UPDATE "subcategories" AS s
SET "order" = ranked.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "category_id" ORDER BY "name" ASC) - 1) AS rn
  FROM "subcategories"
) AS ranked
WHERE s."id" = ranked."id";
