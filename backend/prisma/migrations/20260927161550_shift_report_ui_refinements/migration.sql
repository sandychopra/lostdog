/*
  Warnings:

  - You are about to drop the column `free_fed` on the `cat_entry` table. All the data in the column will be lost.
  - You are about to drop the column `water_noted` on the `cat_entry` table. All the data in the column will be lost.
  - You are about to drop the column `play_notes` on the `shift_report` table. All the data in the column will be lost.
  - You are about to drop the `shift_report_play_cat` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SplitShiftPosition" AS ENUM ('First', 'Second');

-- AlterEnum
ALTER TYPE "FoodAmount" ADD VALUE 'Most';

-- DropForeignKey
ALTER TABLE "shift_report_play_cat" DROP CONSTRAINT "shift_report_play_cat_cat_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_report_play_cat" DROP CONSTRAINT "shift_report_play_cat_shift_report_id_fkey";

-- AlterTable
ALTER TABLE "cat_entry" DROP COLUMN "free_fed",
DROP COLUMN "water_noted";

-- AlterTable
ALTER TABLE "shift_report" DROP COLUMN "play_notes",
ADD COLUMN     "kennel_notes" TEXT,
ADD COLUMN     "split_shift_position" "SplitShiftPosition";

-- DropTable
DROP TABLE "shift_report_play_cat";

-- CreateTable
CREATE TABLE "play_group" (
    "id" SERIAL NOT NULL,
    "shift_report_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "play_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "play_group_cat" (
    "play_group_id" INTEGER NOT NULL,
    "cat_id" INTEGER NOT NULL,

    CONSTRAINT "play_group_cat_pkey" PRIMARY KEY ("play_group_id","cat_id")
);

-- CreateIndex
CREATE INDEX "play_group_shift_report_id_idx" ON "play_group"("shift_report_id");

-- AddForeignKey
ALTER TABLE "play_group" ADD CONSTRAINT "play_group_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_group_cat" ADD CONSTRAINT "play_group_cat_play_group_id_fkey" FOREIGN KEY ("play_group_id") REFERENCES "play_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_group_cat" ADD CONSTRAINT "play_group_cat_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
