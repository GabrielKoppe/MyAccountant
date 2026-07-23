/*
  Budget multi-dimension (Spec 25)

  Troca os 5 FKs escalares do Budget (section_id, category_id, member_user_id,
  institution_id, table_type_id) por 5 arrays de texto (section_ids, category_ids,
  member_user_ids, institution_ids, table_type_ids).

  Arrays não têm FK — as constraints são removidas. O dado existente é preservado
  via BACKFILL: cada coluna array recebe ARRAY[valor] quando a coluna escalar antiga
  não era NULL, senão o array vazio '{}'. Só então as colunas escalares são dropadas.

  As colunas array são adicionadas NOT NULL DEFAULT '{}' (garante empty array em toda
  linha existente durante o ADD COLUMN). Ao final, o DEFAULT do banco é removido: a
  forma canônica de um scalar list String[] no Prisma é TEXT[] NOT NULL sem DEFAULT no
  banco (o empty array é aplicado pelo client). Sem esse DROP DEFAULT, `prisma migrate
  dev` reportaria drift permanente e tentaria gerar uma migração espúria de correção.
*/

-- 1) Remove as foreign keys das colunas escalares (arrays não têm FK)
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_category_id_fkey";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_institution_id_fkey";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_member_user_id_fkey";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_section_id_fkey";
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_table_type_id_fkey";

-- 2) Adiciona as colunas array (NOT NULL, default '{}' garante empty array nas linhas existentes)
ALTER TABLE "budgets" ADD COLUMN "section_ids"     TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "budgets" ADD COLUMN "category_ids"    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "budgets" ADD COLUMN "member_user_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "budgets" ADD COLUMN "institution_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "budgets" ADD COLUMN "table_type_ids"  TEXT[] NOT NULL DEFAULT '{}';

-- 3) BACKFILL: ARRAY[valor] quando o escalar não era NULL; caso contrário mantém '{}'
UPDATE "budgets" SET "section_ids"     = ARRAY["section_id"]     WHERE "section_id"     IS NOT NULL;
UPDATE "budgets" SET "category_ids"    = ARRAY["category_id"]    WHERE "category_id"    IS NOT NULL;
UPDATE "budgets" SET "member_user_ids" = ARRAY["member_user_id"] WHERE "member_user_id" IS NOT NULL;
UPDATE "budgets" SET "institution_ids" = ARRAY["institution_id"] WHERE "institution_id" IS NOT NULL;
UPDATE "budgets" SET "table_type_ids"  = ARRAY["table_type_id"]  WHERE "table_type_id"  IS NOT NULL;

-- 4) Dropa as colunas escalares antigas
ALTER TABLE "budgets" DROP COLUMN "category_id",
DROP COLUMN "institution_id",
DROP COLUMN "member_user_id",
DROP COLUMN "section_id",
DROP COLUMN "table_type_id";

-- 5) Remove o DEFAULT do banco (forma canônica do Prisma p/ String[]: NOT NULL, sem DEFAULT no DB)
ALTER TABLE "budgets" ALTER COLUMN "section_ids"     DROP DEFAULT,
ALTER COLUMN "category_ids"    DROP DEFAULT,
ALTER COLUMN "member_user_ids" DROP DEFAULT,
ALTER COLUMN "institution_ids" DROP DEFAULT,
ALTER COLUMN "table_type_ids"  DROP DEFAULT;
