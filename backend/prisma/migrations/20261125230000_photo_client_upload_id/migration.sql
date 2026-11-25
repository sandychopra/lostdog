-- AlterTable
ALTER TABLE "photo" ADD COLUMN "client_upload_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "photo_client_upload_id_key" ON "photo"("client_upload_id");
