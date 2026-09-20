-- Spec 69 §16 / D8 — `default_sort` e `keep_ghost_row` passaram a ter consumidor
-- real (`TransactionTable`). Os defaults gravados pelo P0 descreviam uma tabela
-- que nunca existiu; publicar os consumidores com eles mudaria o comportamento de
-- TODOS os tipos já criados, sem ninguém ter pedido.
--
-- Princípio: **o default reproduz o que a tabela do mês já faz hoje.**
--
--   * `default_sort` — a tabela sempre renderizou do mais novo para o mais antigo
--     (`FALLBACK_SORT` = `occurredOn`/`desc`). O default era `asc`: honrá-lo
--     inverteria a ordem de todo tipo existente na primeira abertura do mês.
--   * `keep_ghost_row` — a linha vazia de criação só aparecia ao clicar em "Nova
--     transação". O default era `true`: honrá-lo grudaria uma linha vazia
--     permanente no fim de toda tabela. Decisão do usuário (2026-08-12): default
--     `false`; quem quiser a linha permanente liga tipo a tipo na aba
--     "Comportamento".
--
-- Aditiva e idempotente, no molde de
-- `20260811230000_spec69_inherit_on_new_row_default_occurred_on`: nenhum DROP,
-- DELETE ou TRUNCATE, e só toca em quem ainda está exatamente no default antigo.

-- ── 1. Ordenação padrão ────────────────────────────────────────────────────────

-- Default da coluna para tipos criados daqui em diante.
ALTER TABLE "table_types"
  ALTER COLUMN "default_sort" SET DEFAULT '{"key":"occurredOn","dir":"desc"}';

-- Backfill dos tipos que nasceram com o default antigo. A comparação é `jsonb =
-- jsonb` (e não texto): o Postgres normaliza a ordem das chaves ao gravar, então
-- `{"key":…,"dir":…}` e `{"dir":…,"key":…}` são o MESMO valor aqui — um `::text`
-- ou um `LIKE` erraria a linha por causa da ordem/espaçamento.
--
-- A guarda preserva quem já escolheu OUTRA ordenação na aba "Comportamento".
-- Quem tiver escolhido `occurredOn`/`asc` de propósito é indistinguível do
-- default e cai no backfill — o campo nunca teve consumidor, então essa escolha
-- também nunca produziu efeito nenhum na tela.
UPDATE "table_types"
SET "default_sort" = '{"key":"occurredOn","dir":"desc"}'::jsonb
WHERE "default_sort" = '{"key":"occurredOn","dir":"asc"}'::jsonb;

-- ── 2. Linha-fantasma permanente ───────────────────────────────────────────────

ALTER TABLE "table_types"
  ALTER COLUMN "keep_ghost_row" SET DEFAULT false;

-- Aqui não há como distinguir "default antigo" de "usuário ligou": o campo é
-- booleano e nunca teve consumidor, logo NINGUÉM pode tê-lo ligado com efeito.
-- Todo `true` é o default do P0.
UPDATE "table_types"
SET "keep_ghost_row" = false
WHERE "keep_ghost_row" = true;
