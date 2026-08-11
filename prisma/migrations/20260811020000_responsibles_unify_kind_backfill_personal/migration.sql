-- "Tudo é responsável": a UI deixa de distinguir "grupo" de "pessoa externa" — os
-- dois eram só "responsável com 0..N membros". `kind` continua na tabela com DOIS
-- papéis produzíveis: `personal` (automático, 1 por membro) e `group` (comum).
--
-- Esta migração é ADITIVA no schema (nenhuma coluna/tipo alterado) e CORRETIVA nos
-- dados: sem DROP, sem DELETE, sem TRUNCATE.

-- 1) Registros existentes com kind = 'external' viram 'group'.
--    `external` PERMANECE no enum do Postgres (responsible_party_kind) — removê-lo
--    exigiria recriar o tipo e as colunas que o usam (ALTER TYPE ... DROP VALUE não
--    existe), uma operação destrutiva sem ganho. Ele só deixa de ser produzido; ver
--    comentário espelhado em prisma/schema.prisma no enum ResponsiblePartyKind.
UPDATE "responsible_parties"
SET "kind" = 'group'
WHERE "kind" = 'external';

-- 2) Garante que todo membro do account tenha seu responsável pessoal.
--    `ensurePersonalParty` (responsible-party-service.ts) só roda no fluxo de
--    convite — contas antigas (ou dados manipulados fora desse fluxo) podem ter
--    membro sem o vínculo. Backfill idempotente, no mesmo molde da migração
--    20260603000001_backfill_user_settings / 20260703044121_add_responsible_party.
--
--    Defesa contra a unique (account_id, name): se a conta já tiver um responsável
--    com o nome do usuário (nome colidindo, o mais comum: alguém já cadastrou um
--    responsável homônimo), a linha NÃO é criada — fica para o usuário resolver
--    manualmente (vincular o membro à party existente, ou renomear uma das duas).
--    Não adivinhamos qual dos dois objetos é o "certo".
WITH missing AS (
  SELECT am."account_id", am."user_id", COALESCE(u."name", u."email") AS "name"
  FROM "account_members" am
  JOIN "users" u ON u."id" = am."user_id"
  WHERE NOT EXISTS (
    SELECT 1 FROM "responsible_parties" rp
    JOIN "responsible_party_members" rpm ON rpm."party_id" = rp."id"
    WHERE rp."account_id" = am."account_id"
      AND rp."kind" = 'personal'
      AND rpm."user_id" = am."user_id"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "responsible_parties" rp2
    WHERE rp2."account_id" = am."account_id"
      AND rp2."name" = COALESCE(u."name", u."email")
  )
),
inserted AS (
  INSERT INTO "responsible_parties" ("id", "account_id", "name", "kind", "created_at", "updated_at")
  SELECT gen_random_uuid()::text, m."account_id", m."name", 'personal', now(), now()
  FROM missing m
  RETURNING "id", "account_id", "name"
)
INSERT INTO "responsible_party_members" ("party_id", "user_id")
SELECT ins."id", m."user_id"
FROM inserted ins
JOIN missing m ON m."account_id" = ins."account_id" AND m."name" = ins."name";
