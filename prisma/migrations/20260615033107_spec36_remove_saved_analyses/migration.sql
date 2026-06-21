/*
  Warnings:

  - You are about to drop the `saved_analyses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "saved_analyses" DROP CONSTRAINT "saved_analyses_account_id_fkey";

-- DropForeignKey
ALTER TABLE "saved_analyses" DROP CONSTRAINT "saved_analyses_created_by_id_fkey";

-- DropTable
DROP TABLE "saved_analyses";
