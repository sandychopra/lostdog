-- CreateTable
CREATE TABLE "shift_report_kennel_flag" (
    "shift_report_id" INTEGER NOT NULL,
    "kennel_id" INTEGER NOT NULL,

    CONSTRAINT "shift_report_kennel_flag_pkey" PRIMARY KEY ("shift_report_id","kennel_id")
);

-- AddForeignKey
ALTER TABLE "shift_report_kennel_flag" ADD CONSTRAINT "shift_report_kennel_flag_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_kennel_flag" ADD CONSTRAINT "shift_report_kennel_flag_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
