-- AlterTable
ALTER TABLE "user" DROP COLUMN "active",
ADD COLUMN "deletedAt" TIMESTAMP(3);
