-- CreateEnum
CREATE TYPE "ShiftReportStatus" AS ENUM ('Draft', 'Submitted');

-- AlterTable
ALTER TABLE "shift_report" ADD COLUMN     "status" "ShiftReportStatus" NOT NULL DEFAULT 'Draft',
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- Backfill: pre-existing reports were already finalized under the old
-- single-status model, so they become Submitted rather than defaulting to
-- Draft (which would otherwise misleadingly badge every historical report).
UPDATE "shift_report" SET "status" = 'Submitted', "submitted_at" = "created_at";
