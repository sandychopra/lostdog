-- Data cleanup for the cats-page refinements. Kept separate from the schema
-- migration because Postgres can't use an enum value ('NotNeeded') in the same
-- transaction that adds it.

-- 1. Dewormer: "Due" now requires a due date. Cats marked Due with no date
--    become NotNeeded, and their dateless DewormerDue announcements close.
UPDATE "announcement" a
SET "resolved" = true, "resolved_at" = now()
FROM "cat" c
WHERE a."cat_id" = c."id"
  AND a."type" = 'DewormerDue'
  AND a."resolved" = false
  AND c."dewormer_status" = 'Due'
  AND c."dewormer_due_date" IS NULL;

UPDATE "cat" SET "dewormer_status" = 'NotNeeded'
WHERE "dewormer_status" = 'Due' AND "dewormer_due_date" IS NULL;

-- 2. Picked-up cats leave the active roster, their kennel and their group, and
--    everything still open about them is closed out.
UPDATE "announcement" SET "resolved" = true, "resolved_at" = now()
WHERE "resolved" = false
  AND "cat_id" IN (SELECT "id" FROM "cat" WHERE "status" = 'PickedUp');

UPDATE "sign_task" SET "state" = 'Cancelled'
WHERE "state" = 'Open'
  AND "cat_id" IN (SELECT "id" FROM "cat" WHERE "status" = 'PickedUp');

UPDATE "kennel_move_request" SET "state" = 'Cancelled'
WHERE "state" = 'Open'
  AND "cat_id" IN (SELECT "id" FROM "cat" WHERE "status" = 'PickedUp');

UPDATE "cat" SET "active" = false WHERE "status" = 'PickedUp';

-- 3. Any inactive cat (picked up or returned to RCC) no longer occupies a
--    kennel or belongs to a group. Remember which groups that touches.
CREATE TABLE "_affected_group" AS
SELECT DISTINCT "group_id" AS "id" FROM "cat"
WHERE "active" = false AND "group_id" IS NOT NULL;

UPDATE "cat" SET "kennel_id" = NULL, "group_id" = NULL WHERE "active" = false;

-- 4. Groups left with a single cat dissolve: that cat takes the group's kennel.
UPDATE "cat" c
SET "kennel_id" = g."kennel_id", "group_id" = NULL
FROM "group" g
WHERE c."group_id" = g."id"
  AND g."id" IN (SELECT "id" FROM "_affected_group")
  AND (SELECT count(*) FROM "cat" c2 WHERE c2."group_id" = g."id") = 1;

-- 5. Affected groups that now have no cats: cancel any open move request for
--    them, then delete the ones nothing references. A group with history
--    (shift-report entries, checklist steps, move requests) can't be deleted —
--    those rows' check constraints need their group — so it's retired instead:
--    it keeps its id but no longer holds a kennel.
CREATE TABLE "_empty_group" AS
SELECT g."id" FROM "group" g
WHERE g."id" IN (SELECT "id" FROM "_affected_group")
  AND NOT EXISTS (SELECT 1 FROM "cat" c WHERE c."group_id" = g."id");

UPDATE "kennel_move_request" SET "state" = 'Cancelled'
WHERE "state" = 'Open' AND "group_id" IN (SELECT "id" FROM "_empty_group");

UPDATE "group" SET "kennel_id" = NULL WHERE "id" IN (SELECT "id" FROM "_empty_group");

DELETE FROM "group" g
WHERE g."id" IN (SELECT "id" FROM "_empty_group")
  AND NOT EXISTS (SELECT 1 FROM "cat_entry" e WHERE e."group_id" = g."id")
  AND NOT EXISTS (SELECT 1 FROM "checklist_action" a WHERE a."group_id" = g."id")
  AND NOT EXISTS (SELECT 1 FROM "kennel_move_request" m WHERE m."group_id" = g."id");

DROP TABLE "_empty_group";
DROP TABLE "_affected_group";
