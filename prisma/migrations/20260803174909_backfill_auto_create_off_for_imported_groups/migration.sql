-- Spec 73 §2.4 — backfill de `auto_create_on_new_month`.
--
-- A migração anterior adicionou a coluna com DEFAULT true, o que é o padrão
-- correto para parcelamento criado à mão, mas errado para grupo criado por
-- import de fatura: nesse caso a própria fatura é a fonte da parcela, e deixar
-- a criação automática ligada faz a parcela ser lançada duas vezes (uma ao
-- abrir o mês, outra ao importar o CSV daquele mês).
--
-- Marca como `false` todo grupo que tenha ao menos uma transação de origem
-- csv_import/xlsx_import — o mesmo critério que o `executeImport` passou a
-- aplicar para grupos novos.
UPDATE "installment_groups" g
SET "auto_create_on_new_month" = false
WHERE EXISTS (
  SELECT 1
  FROM "transactions" t
  WHERE t."installment_group_id" = g."id"
    AND t."source" IN ('csv_import', 'xlsx_import')
);
