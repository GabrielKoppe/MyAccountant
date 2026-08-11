-- Spec 68 (revisão de estilo) — backfill de `last_used_at`.
--
-- POR QUE ISTO É NECESSÁRIO: a Spec 67 §7.4 decidiu gravar `last_used_at` na ESCRITA
-- que consome o objeto (`settings-usage-touch.ts`), o que é certo daqui para frente e
-- de custo zero na leitura. Mas não houve backfill: toda conta existente ficou com a
-- coluna nula em tudo, e a coluna Status passou a exibir "nunca usada" para seções,
-- categorias e instituições com centenas de transações atrás delas. A informação não
-- estava só faltando — estava ERRADA, e é a única coisa que a lista diz sobre uso.
--
-- A data usada é a da transação mais recente que referencia o objeto (`occurred_on`),
-- que é exatamente o que o rótulo "usada em jul" comunica.
--
-- `WHERE last_used_at IS NULL`: não sobrescreve o que o mecanismo de escrita já
-- gravou. Rodar de novo é inofensivo.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "sections" s
SET "last_used_at" = agg.max_at
FROM (
  SELECT "section_id" AS id, MAX("occurred_on")::timestamp AS max_at
  FROM "transactions"
  WHERE "section_id" IS NOT NULL
  GROUP BY "section_id"
) AS agg
WHERE s."id" = agg.id AND s."last_used_at" IS NULL;

UPDATE "categories" c
SET "last_used_at" = agg.max_at
FROM (
  SELECT "category_id" AS id, MAX("occurred_on")::timestamp AS max_at
  FROM "transactions"
  WHERE "category_id" IS NOT NULL
  GROUP BY "category_id"
) AS agg
WHERE c."id" = agg.id AND c."last_used_at" IS NULL;

UPDATE "subcategories" sc
SET "last_used_at" = agg.max_at
FROM (
  SELECT "subcategory_id" AS id, MAX("occurred_on")::timestamp AS max_at
  FROM "transactions"
  WHERE "subcategory_id" IS NOT NULL
  GROUP BY "subcategory_id"
) AS agg
WHERE sc."id" = agg.id AND sc."last_used_at" IS NULL;

UPDATE "institutions" i
SET "last_used_at" = agg.max_at
FROM (
  SELECT "institution_id" AS id, MAX("occurred_on")::timestamp AS max_at
  FROM "transactions"
  WHERE "institution_id" IS NOT NULL
  GROUP BY "institution_id"
) AS agg
WHERE i."id" = agg.id AND i."last_used_at" IS NULL;

UPDATE "responsible_parties" rp
SET "last_used_at" = agg.max_at
FROM (
  SELECT "responsible_party_id" AS id, MAX("occurred_on")::timestamp AS max_at
  FROM "transactions"
  WHERE "responsible_party_id" IS NOT NULL
  GROUP BY "responsible_party_id"
) AS agg
WHERE rp."id" = agg.id AND rp."last_used_at" IS NULL;
