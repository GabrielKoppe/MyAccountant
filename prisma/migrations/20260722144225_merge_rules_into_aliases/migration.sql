/*
  Warnings:

  - You are about to drop the `categorization_rule_tags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `categorization_rules` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "alias_match_mode" AS ENUM ('contains', 'regex');

-- CreateEnum
CREATE TYPE "alias_priority" AS ENUM ('high', 'medium', 'low');

-- DropForeignKey
ALTER TABLE "categorization_rule_tags" DROP CONSTRAINT "categorization_rule_tags_rule_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rule_tags" DROP CONSTRAINT "categorization_rule_tags_tag_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_account_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_condition_institution_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_set_category_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_set_institution_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_set_responsible_party_id_fkey";

-- DropForeignKey
ALTER TABLE "categorization_rules" DROP CONSTRAINT "categorization_rules_set_subcategory_id_fkey";

-- AlterTable
ALTER TABLE "transaction_aliases" ADD COLUMN     "condition_institution_id" TEXT,
ADD COLUMN     "max_cents" BIGINT,
ADD COLUMN     "min_cents" BIGINT,
ADD COLUMN     "priority" "alias_priority" NOT NULL DEFAULT 'medium',
ADD COLUMN     "trigger_mode" "alias_match_mode" NOT NULL DEFAULT 'contains';

-- DropTable
DROP TABLE "categorization_rule_tags";

-- DropTable
DROP TABLE "categorization_rules";

-- DropEnum
DROP TYPE "categorization_match_mode";

-- AddForeignKey
ALTER TABLE "transaction_aliases" ADD CONSTRAINT "transaction_aliases_condition_institution_id_fkey" FOREIGN KEY ("condition_institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
