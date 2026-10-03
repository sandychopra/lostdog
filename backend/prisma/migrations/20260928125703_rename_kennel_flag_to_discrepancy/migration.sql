/*
  Warnings:

  - You are about to drop the `shift_report_kennel_flag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "shift_report_kennel_flag" DROP CONSTRAINT "shift_report_kennel_flag_kennel_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_report_kennel_flag" DROP CONSTRAINT "shift_report_kennel_flag_shift_report_id_fkey";

-- DropTable
DROP TABLE "shift_report_kennel_flag";

-- CreateTable
CREATE TABLE "shift_report_kennel_discrepancy" (
    "shift_report_id" INTEGER NOT NULL,
    "kennel_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "shift_report_kennel_discrepancy_pkey" PRIMARY KEY ("shift_report_id","kennel_id")
);

-- AddForeignKey
ALTER TABLE "shift_report_kennel_discrepancy" ADD CONSTRAINT "shift_report_kennel_discrepancy_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_kennel_discrepancy" ADD CONSTRAINT "shift_report_kennel_discrepancy_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
