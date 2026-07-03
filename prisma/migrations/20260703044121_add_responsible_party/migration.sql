-- CreateEnum
CREATE TYPE "responsible_party_kind" AS ENUM ('personal', 'group', 'external');

-- AlterTable
ALTER TABLE "account_settings" ADD COLUMN     "default_responsible_party_id" TEXT;

-- AlterTable
ALTER TABLE "table_template_items" ADD COLUMN     "responsible_party_id" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "responsible_party_id" TEXT;

-- CreateTable
CREATE TABLE "responsible_parties" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "responsible_party_kind" NOT NULL,
    "icon" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "responsible_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responsible_party_members" (
    "party_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "responsible_party_members_pkey" PRIMARY KEY ("party_id","user_id")
);

-- CreateIndex
CREATE INDEX "responsible_parties_account_id_idx" ON "responsible_parties"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "responsible_parties_account_id_name_key" ON "responsible_parties"("account_id", "name");

-- CreateIndex
CREATE INDEX "responsible_party_members_user_id_idx" ON "responsible_party_members"("user_id");

-- CreateIndex
CREATE INDEX "transactions_responsible_party_id_idx" ON "transactions"("responsible_party_id");

-- AddForeignKey
ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_default_responsible_party_id_fkey" FOREIGN KEY ("default_responsible_party_id") REFERENCES "responsible_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_parties" ADD CONSTRAINT "responsible_parties_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_party_members" ADD CONSTRAINT "responsible_party_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "responsible_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responsible_party_members" ADD CONSTRAINT "responsible_party_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_responsible_party_id_fkey" FOREIGN KEY ("responsible_party_id") REFERENCES "responsible_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_template_items" ADD CONSTRAINT "table_template_items_responsible_party_id_fkey" FOREIGN KEY ("responsible_party_id") REFERENCES "responsible_parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- Backfill (Spec 60 §3): uma ResponsibleParty 'personal' por (account, user)
-- responsável legado ou membro atual. Idempotente: guard por link personal existente.
-- =====================================================================
WITH candidate_pairs AS (
  SELECT DISTINCT account_id, user_id FROM (
    SELECT account_id, user_id FROM account_members
    UNION
    SELECT account_id, responsible_user_id AS user_id FROM transactions WHERE responsible_user_id IS NOT NULL
    UNION
    SELECT account_id, responsible_user_id AS user_id FROM table_template_items WHERE responsible_user_id IS NOT NULL
    UNION
    SELECT account_id, default_responsible_user_id AS user_id FROM account_settings WHERE default_responsible_user_id IS NOT NULL
  ) s
),
missing AS (
  SELECT cp.account_id, cp.user_id, COALESCE(u.name, u.email) AS name
  FROM candidate_pairs cp
  JOIN users u ON u.id = cp.user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM responsible_party_members rpm
    JOIN responsible_parties rp ON rp.id = rpm.party_id
    WHERE rp.account_id = cp.account_id AND rpm.user_id = cp.user_id AND rp.kind = 'personal'
  )
),
inserted AS (
  INSERT INTO responsible_parties (id, account_id, name, kind, created_at, updated_at)
  SELECT gen_random_uuid()::text, m.account_id, m.name, 'personal', now(), now()
  FROM missing m
  RETURNING id, account_id, name
)
INSERT INTO responsible_party_members (party_id, user_id)
SELECT ins.id, m.user_id
FROM inserted ins
JOIN missing m ON m.account_id = ins.account_id AND m.name = ins.name;

-- Backfill transactions.responsible_party_id
UPDATE transactions t
SET responsible_party_id = rp.id
FROM responsible_party_members rpm
JOIN responsible_parties rp ON rp.id = rpm.party_id AND rp.kind = 'personal'
WHERE rpm.user_id = t.responsible_user_id
  AND rp.account_id = t.account_id
  AND t.responsible_user_id IS NOT NULL
  AND t.responsible_party_id IS NULL;

-- Backfill table_template_items.responsible_party_id
UPDATE table_template_items tti
SET responsible_party_id = rp.id
FROM responsible_party_members rpm
JOIN responsible_parties rp ON rp.id = rpm.party_id AND rp.kind = 'personal'
WHERE rpm.user_id = tti.responsible_user_id
  AND rp.account_id = tti.account_id
  AND tti.responsible_user_id IS NOT NULL
  AND tti.responsible_party_id IS NULL;

-- Backfill account_settings.default_responsible_party_id
UPDATE account_settings s
SET default_responsible_party_id = rp.id
FROM responsible_party_members rpm
JOIN responsible_parties rp ON rp.id = rpm.party_id AND rp.kind = 'personal'
WHERE rpm.user_id = s.default_responsible_user_id
  AND rp.account_id = s.account_id
  AND s.default_responsible_user_id IS NOT NULL
  AND s.default_responsible_party_id IS NULL;
