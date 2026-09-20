-- Spec 69 §16 / D8 — `inheritOnNewRow` passou a ter consumidor real
-- (`NewTransactionRow`): chave presente = herda da linha recém-criada, chave
-- ausente = limpa. O P0 gravou `[]` como default, mas a linha-fantasma SEMPRE
-- preservou a data entre lançamentos consecutivos — publicar o consumidor com
-- `[]` tiraria esse comportamento de todo mundo, sem aviso.
--
-- Aditivo e idempotente: só mexe em quem ainda está exatamente no default antigo.

-- 1. Default da coluna para tipos criados daqui em diante.
ALTER TABLE "table_types" ALTER COLUMN "inherit_on_new_row" SET DEFAULT '["occurredOn"]';

-- 2. Backfill dos tipos que nasceram com o default antigo. A guarda `= '[]'`
--    preserva quem já escolheu alguma herança na aba "Comportamento".
UPDATE "table_types"
SET "inherit_on_new_row" = '["occurredOn"]'::jsonb
WHERE "inherit_on_new_row" = '[]'::jsonb;
