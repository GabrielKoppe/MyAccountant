-- Spec 68 (revisão de Responsáveis) — conserta os `personal` sem membro vinculado.
--
-- POR QUE ISTO É NECESSÁRIO: a regra nova diz que `personal` é o responsável criado
-- AUTOMATICAMENTE para um usuário do account, com o membro fixo e não editável. A
-- migração anterior não conseguiu criar os que faltavam porque já existia um
-- responsável com o mesmo nome — e a UI nova trava as linhas `personal`, então esses
-- registros ficariam sem membro e sem nenhum caminho para consertar. Beco sem saída.
--
-- Duas situações reais no banco, tratadas separadamente:
--
--  (1) `personal` sem membro cujo nome CASA com um membro do account
--      → é o responsável daquele usuário, só faltou o vínculo. Vincula.
--
--  (2) `personal` sem membro que NÃO casa com nenhum membro do account
--      → não é o responsável de um usuário: é um rótulo herdado do MVP (uma pessoa
--        que não usa a plataforma). Sob a regra nova isso é um responsável COMUM com
--        0 membros. Converte para `group`, o que também o destrava na tela.
--
-- Sem `DROP`/`DELETE`/`TRUNCATE`. Idempotente: rodar de novo não muda nada.
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) Vincula o usuário ao seu `personal` órfão, casando por nome ou e-mail.
INSERT INTO "responsible_party_members" ("party_id", "user_id")
SELECT rp."id", am."user_id"
FROM "responsible_parties" rp
JOIN "account_members" am ON am."account_id" = rp."account_id"
JOIN "users" u ON u."id" = am."user_id"
WHERE rp."kind" = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM "responsible_party_members" m WHERE m."party_id" = rp."id"
  )
  AND rp."name" = COALESCE(u."name", u."email")
ON CONFLICT DO NOTHING;

-- (2) O que sobrou sem membro não pertence a usuário nenhum: é responsável comum.
UPDATE "responsible_parties" rp
SET "kind" = 'group'
WHERE rp."kind" = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM "responsible_party_members" m WHERE m."party_id" = rp."id"
  );
