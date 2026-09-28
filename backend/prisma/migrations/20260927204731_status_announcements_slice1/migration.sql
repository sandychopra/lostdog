-- AlterEnum
ALTER TYPE "CatStatus" ADD VALUE 'PickedUp';

-- AlterEnum
ALTER TYPE "KennelState" ADD VALUE 'Planned';

-- AlterEnum
ALTER TYPE "SignAction" ADD VALUE 'RemoveAdopted';

-- AlterTable
ALTER TABLE "cat" ADD COLUMN     "picked_up_at" TIMESTAMP(3),
ADD COLUMN     "picked_up_by_id" TEXT,
ADD COLUMN     "picked_up_on_report_id" INTEGER;

-- AddForeignKey
ALTER TABLE "cat" ADD CONSTRAINT "cat_picked_up_by_id_fkey" FOREIGN KEY ("picked_up_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat" ADD CONSTRAINT "cat_picked_up_on_report_id_fkey" FOREIGN KEY ("picked_up_on_report_id") REFERENCES "shift_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;
