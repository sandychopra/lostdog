-- AlterEnum
ALTER TYPE "ChecklistActionType" ADD VALUE 'FreeText';

-- DropForeignKey
ALTER TABLE "checklist_action" DROP CONSTRAINT "checklist_action_kennel_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_report_kennel_discrepancy" DROP CONSTRAINT "shift_report_kennel_discrepancy_kennel_id_fkey";

-- DropForeignKey
ALTER TABLE "shift_report_kennel_discrepancy" DROP CONSTRAINT "shift_report_kennel_discrepancy_shift_report_id_fkey";

-- AlterTable
ALTER TABLE "checklist_action" ADD COLUMN     "description" TEXT,
ALTER COLUMN "kennel_id" DROP NOT NULL;

-- DropTable
DROP TABLE "shift_report_kennel_discrepancy";

-- CreateTable
CREATE TABLE "shift_report_kennel_status" (
    "shift_report_id" INTEGER NOT NULL,
    "kennel_id" INTEGER NOT NULL,
    "reported_state" "KennelState" NOT NULL,
    "note" TEXT,

    CONSTRAINT "shift_report_kennel_status_pkey" PRIMARY KEY ("shift_report_id","kennel_id")
);

-- AddForeignKey
ALTER TABLE "shift_report_kennel_status" ADD CONSTRAINT "shift_report_kennel_status_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_kennel_status" ADD CONSTRAINT "shift_report_kennel_status_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
-- Replaces the original: ResetKennel/MoveCat now require kennel_id explicitly
-- (it's nullable at the column level to allow FreeText), and FreeText requires
-- description with no kennel/cat/group.
ALTER TABLE "checklist_action" DROP CONSTRAINT "checklist_action_type_target_check";
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_type_target_check" CHECK (
  ("action_type" = 'ResetKennel' AND "kennel_id" IS NOT NULL AND "cat_id" IS NULL AND "group_id" IS NULL AND "description" IS NULL) OR
  ("action_type" = 'MoveCat' AND "kennel_id" IS NOT NULL AND "description" IS NULL AND (
    ("cat_id" IS NOT NULL AND "group_id" IS NULL) OR
    ("cat_id" IS NULL AND "group_id" IS NOT NULL)
  )) OR
  ("action_type" = 'FreeText' AND "kennel_id" IS NULL AND "cat_id" IS NULL AND "group_id" IS NULL AND "description" IS NOT NULL)
);
