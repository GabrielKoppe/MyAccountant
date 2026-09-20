-- AlterTable
ALTER TABLE "dashboard_layouts" ADD COLUMN     "draft" JSONB,
ADD COLUMN     "published_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "finance_tables" ADD COLUMN     "created_from_template_id" TEXT;

-- AlterTable
ALTER TABLE "table_template_items" ADD COLUMN     "day_rule" TEXT;

-- AlterTable
ALTER TABLE "table_templates" ADD COLUMN     "order_in_section" INTEGER;

-- AlterTable
ALTER TABLE "table_types" ADD COLUMN     "allow_bulk_edit" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "default_sort" JSONB NOT NULL DEFAULT '{"key":"occurredOn","dir":"asc"}',
ADD COLUMN     "density" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "group_by" TEXT,
ADD COLUMN     "inherit_on_new_row" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "keep_ghost_row" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pinned_columns" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "show_footer_total" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_group_subtotal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visible_columns" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "finance_tables_account_id_created_from_template_id_idx" ON "finance_tables"("account_id", "created_from_template_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfills (Spec 69 §14 P0). Todos ADITIVOS e IDEMPOTENTES: nenhum DROP, DELETE
-- ou TRUNCATE, e cada UPDATE tem guarda para poder rodar de novo sem estragar
-- nada. Nada aqui remove `hidden_columns` nem `auto_table_type_id` — os dois
-- ficam vivos como espelho derivado até a Spec 66 / o pacote P8 (FU-3).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. D4 — `rich` era o nome do layout B; o nome canônico passa a ser `pills`.
--    Sem isto, um tipo salvo antes desta migração cai fora do enum Zod e o parse
--    cairia no default "columns", trocando o layout do usuário em silêncio.
UPDATE "table_types"
SET "row_layout" = 'pills'
WHERE "row_layout" = 'rich';

-- 2. D3 — `visible_columns` = ordem canônica das colunas MENOS as marcadas como
--    ocultas em `hidden_columns`. A lista abaixo é a mesma (e na mesma ordem) de
--    `src/lib/table-columns.ts` — as duas mudam juntas.
--    `occurredOn`, `description` e `amount` são `locked` e nunca aparecem em
--    `hidden_columns`, então entram sempre.
--    Guarda `= '[]'::jsonb`: só preenche quem ainda está no default.
UPDATE "table_types" t
SET "visible_columns" = COALESCE(
  (
    SELECT jsonb_agg(c.col ORDER BY c.ord)
    FROM unnest(ARRAY[
      'occurredOn',
      'description',
      'category',
      'subcategory',
      'institution',
      'paymentMethod',
      'responsibleUser',
      'isPending',
      'cardInstallment',
      'investmentType',
      'expenseType',
      'tags',
      'notes',
      'amount'
    ]) WITH ORDINALITY AS c(col, ord)
    WHERE COALESCE((t."hidden_columns" ->> c.col)::boolean, false) = false
  ),
  '[]'::jsonb
)
WHERE t."visible_columns" = '[]'::jsonb;

-- 3. D2 — `day_rule` é a forma rica de `day`. Todo item existente é dia fixo.
UPDATE "table_template_items"
SET "day_rule" = "day"::text
WHERE "day_rule" IS NULL;

-- 4. D7 — consolidação do tipo de tabela do modelo em `table_type_id`.
--    `auto_table_type_id` NÃO é apagado: `month-service.applyAutoTemplates`
--    ainda o lê e o exige para liberar a automação (dropado no P8/FU-3).
UPDATE "table_templates"
SET "table_type_id" = "auto_table_type_id"
WHERE "table_type_id" IS NULL
  AND "auto_table_type_id" IS NOT NULL;
