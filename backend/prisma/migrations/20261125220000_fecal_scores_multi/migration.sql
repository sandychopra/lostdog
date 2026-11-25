-- Fecal score becomes multi-select, with an explicit "Empty" answer.
ALTER TABLE "cat_entry" ADD COLUMN "fecal_scores" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "cat_entry" ADD COLUMN "fecal_empty" BOOLEAN NOT NULL DEFAULT false;

-- Carry existing single scores over; blanks stay "not recorded".
UPDATE "cat_entry" SET "fecal_scores" = ARRAY["fecal_score"] WHERE "fecal_score" IS NOT NULL;

ALTER TABLE "cat_entry" DROP COLUMN "fecal_score";
