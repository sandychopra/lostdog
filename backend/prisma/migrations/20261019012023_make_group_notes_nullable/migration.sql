-- AlterTable
ALTER TABLE "meet_and_greet" ALTER COLUMN "note" DROP NOT NULL;

-- AlterTable
ALTER TABLE "play_group" ALTER COLUMN "note" DROP NOT NULL;

-- Blank notes saved before the column allowed NULL become NULL, matching
-- every other optional note field.
UPDATE "meet_and_greet" SET "note" = NULL WHERE "note" = '';
UPDATE "play_group" SET "note" = NULL WHERE "note" = '';
