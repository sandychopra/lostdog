-- Removes the ChecklistAssigned AnnouncementType value. Checklist-style
-- announcements are now created as Manual with an attached checklist instead
-- (see backend/src/routes/announcements.ts); nothing creates ChecklistAssigned
-- rows anymore. Per explicit instruction, any existing rows of this type are
-- deleted rather than migrated to another type.
DELETE FROM "announcement" WHERE "type" = 'ChecklistAssigned';

-- Postgres has no ALTER TYPE ... DROP VALUE — recreate the enum without it.
ALTER TYPE "AnnouncementType" RENAME TO "AnnouncementType_old";

CREATE TYPE "AnnouncementType" AS ENUM (
  'NewArrival',
  'PendingAdoption',
  'Adopted',
  'BackAvailable',
  'ReturnedToRcc',
  'KennelMoveRequested',
  'KennelNeedsReset',
  'Manual'
);

ALTER TABLE "announcement"
  ALTER COLUMN "type" TYPE "AnnouncementType" USING ("type"::text::"AnnouncementType");

DROP TYPE "AnnouncementType_old";
