-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "email_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email_last_error" TEXT;

-- AlterTable
ALTER TABLE "shift_report" ADD COLUMN     "email_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email_last_error" TEXT,
ADD COLUMN     "email_sent_at" TIMESTAMP(3);

-- Existing history predates email notifications: mark it as already handled so
-- the first flush doesn't send the whole backlog to the Google Group.
UPDATE "announcement" SET "email_sent" = true;
UPDATE "shift_report" SET "email_sent_at" = COALESCE("submitted_at", now()) WHERE "status" = 'Submitted';
