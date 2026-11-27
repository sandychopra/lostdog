-- Rename Announcement -> Notification. Pure renames: no rows, values or
-- column types change. (Postgres 18's "*_not_null" constraint names are left
-- as they are — they don't exist on older servers and Prisma ignores them.)

-- Enum type
ALTER TYPE "AnnouncementType" RENAME TO "NotificationType";

-- Table, sequence, primary key
ALTER TABLE "announcement" RENAME TO "notification";
ALTER SEQUENCE "announcement_id_seq" RENAME TO "notification_id_seq";
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_pkey" TO "notification_pkey";

-- The table's own foreign keys and indexes
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_cat_id_fkey" TO "notification_cat_id_fkey";
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_checklist_id_fkey" TO "notification_checklist_id_fkey";
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_kennel_id_fkey" TO "notification_kennel_id_fkey";
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_resolved_by_id_fkey" TO "notification_resolved_by_id_fkey";
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_created_by_id_fkey" TO "notification_created_by_id_fkey";
ALTER TABLE "notification" RENAME CONSTRAINT "announcement_commented_by_id_fkey" TO "notification_commented_by_id_fkey";
ALTER INDEX "announcement_cat_id_idx" RENAME TO "notification_cat_id_idx";
ALTER INDEX "announcement_checklist_id_idx" RENAME TO "notification_checklist_id_idx";
ALTER INDEX "announcement_kennel_id_idx" RENAME TO "notification_kennel_id_idx";

-- Columns pointing at it from sign_task and kennel_move_request
ALTER TABLE "sign_task" RENAME COLUMN "announcement_id" TO "notification_id";
ALTER TABLE "sign_task" RENAME CONSTRAINT "sign_task_announcement_id_fkey" TO "sign_task_notification_id_fkey";
ALTER INDEX "sign_task_announcement_id_idx" RENAME TO "sign_task_notification_id_idx";

ALTER TABLE "kennel_move_request" RENAME COLUMN "announcement_id" TO "notification_id";
ALTER TABLE "kennel_move_request" RENAME CONSTRAINT "kennel_move_request_announcement_id_fkey" TO "kennel_move_request_notification_id_fkey";
