-- AlterTable
ALTER TABLE "table_templates" ADD COLUMN     "auto_apply" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_section_id" TEXT,
ADD COLUMN     "auto_table_type_id" TEXT;
