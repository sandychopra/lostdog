-- Kennel Notes is removed from shift reports; Other Notes covers it. Existing
-- kennel notes are deleted with the column (decided, not migrated).
ALTER TABLE "shift_report" DROP COLUMN "kennel_notes";
