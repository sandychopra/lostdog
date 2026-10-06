/*
  Warnings:

  - You are about to drop the column `snack_treat` on the `cat_entry` table. All the data in the column will be lost.
  - You are about to drop the column `wet_food_brand` on the `cat_entry` table. All the data in the column will be lost.
  - You are about to drop the column `snack_treat` on the `group_entry_cat_detail` table. All the data in the column will be lost.
  - You are about to drop the column `wet_food_brand` on the `group_entry_cat_detail` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cat_entry" DROP COLUMN "snack_treat",
DROP COLUMN "wet_food_brand";

-- AlterTable
ALTER TABLE "group_entry_cat_detail" DROP COLUMN "snack_treat",
DROP COLUMN "wet_food_brand";

-- DropEnum
DROP TYPE "SnackTreat";
