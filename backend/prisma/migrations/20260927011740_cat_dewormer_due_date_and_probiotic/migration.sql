-- AlterTable
ALTER TABLE "cat" DROP COLUMN "needs_proviable",
ADD COLUMN     "dewormer_due_date" DATE,
ADD COLUMN     "needs_probiotic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "cat_entry" DROP COLUMN "proviable_given",
ADD COLUMN     "probiotic_given" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "group_entry_cat_detail" DROP COLUMN "proviable_given",
ADD COLUMN     "probiotic_given" BOOLEAN NOT NULL DEFAULT false;
