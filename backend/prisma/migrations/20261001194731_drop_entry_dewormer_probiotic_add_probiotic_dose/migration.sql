-- AlterTable
ALTER TABLE "cat_entry" DROP COLUMN "dewormer_given",
DROP COLUMN "probiotic_given";

-- AlterTable
ALTER TABLE "group_entry_cat_detail" DROP COLUMN "dewormer_given",
DROP COLUMN "probiotic_given";

-- CreateTable
CREATE TABLE "probiotic_dose" (
    "id" SERIAL NOT NULL,
    "cat_id" INTEGER NOT NULL,
    "logged_by_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "probiotic_dose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "probiotic_dose_cat_id_idx" ON "probiotic_dose"("cat_id");

-- AddForeignKey
ALTER TABLE "probiotic_dose" ADD CONSTRAINT "probiotic_dose_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probiotic_dose" ADD CONSTRAINT "probiotic_dose_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
