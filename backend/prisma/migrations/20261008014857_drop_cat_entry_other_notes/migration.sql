/*
  Warnings:

  - You are about to drop the column `other_notes` on the `cat_entry` table. All the data in the column will be lost.
  - You are about to drop the column `other_notes` on the `group_entry_cat_detail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cat_entry" DROP COLUMN "other_notes";

-- AlterTable
ALTER TABLE "group_entry_cat_detail" DROP COLUMN "other_notes";
