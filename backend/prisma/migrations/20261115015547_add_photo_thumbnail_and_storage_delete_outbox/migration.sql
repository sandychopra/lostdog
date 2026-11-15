-- AlterTable
ALTER TABLE "photo" ADD COLUMN     "thumbnail_key" TEXT;

-- CreateTable
CREATE TABLE "pending_storage_delete" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_storage_delete_pkey" PRIMARY KEY ("id")
);
