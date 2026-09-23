-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Volunteer', 'Admin');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'Volunteer';
