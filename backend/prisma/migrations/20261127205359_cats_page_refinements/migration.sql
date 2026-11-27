-- AlterEnum
ALTER TYPE "AnnouncementType" ADD VALUE 'PickedUp';

-- AlterEnum
ALTER TYPE "DewormerStatus" ADD VALUE 'NotNeeded';

-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "dismiss_note" TEXT,
ADD COLUMN     "dismissed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cat" ALTER COLUMN "dewormer_status" SET DEFAULT 'NotNeeded';
