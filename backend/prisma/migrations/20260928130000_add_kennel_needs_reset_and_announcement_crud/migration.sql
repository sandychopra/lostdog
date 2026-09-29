-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AnnouncementType" ADD VALUE 'KennelNeedsReset';
ALTER TYPE "AnnouncementType" ADD VALUE 'Manual';

-- DropForeignKey
ALTER TABLE "cat" DROP CONSTRAINT "cat_picked_up_on_report_id_fkey";

-- DropForeignKey
ALTER TABLE "kennel_move_request" DROP CONSTRAINT "kennel_move_request_completed_on_report_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_report_kennel_reset" DROP CONSTRAINT "shift_report_kennel_reset_kennel_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_report_kennel_reset" DROP CONSTRAINT "shift_report_kennel_reset_shift_report_id_fkey";

-- DropForeignKey
ALTER TABLE "sign_task" DROP CONSTRAINT "sign_task_completed_on_report_id_fkey";

-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "commented_at" TIMESTAMP(3),
ADD COLUMN     "commented_by_id" TEXT,
ADD COLUMN     "created_by_id" TEXT,
ADD COLUMN     "kennel_id" INTEGER,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "cat" DROP COLUMN "picked_up_on_report_id";

-- AlterTable
ALTER TABLE "kennel_move_request" DROP COLUMN "completed_on_report_id";

-- AlterTable
ALTER TABLE "sign_task" DROP COLUMN "completed_on_report_id";

-- DropTable
DROP TABLE "shift_report_kennel_reset";

-- CreateIndex
CREATE INDEX "announcement_kennel_id_idx" ON "announcement"("kennel_id");

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_commented_by_id_fkey" FOREIGN KEY ("commented_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

