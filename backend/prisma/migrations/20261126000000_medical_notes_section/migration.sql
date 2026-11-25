-- Medical notes move out of cat entries into their own per-cat records, so a
-- note can be written about any cat in care, with or without a Food card.
CREATE TABLE "medical_note" (
    "id" SERIAL NOT NULL,
    "shift_report_id" INTEGER NOT NULL,
    "cat_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_note_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medical_note_cat_id_idx" ON "medical_note"("cat_id");
CREATE UNIQUE INDEX "medical_note_shift_report_id_cat_id_key" ON "medical_note"("shift_report_id", "cat_id");

ALTER TABLE "medical_note" ADD CONSTRAINT "medical_note_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medical_note" ADD CONSTRAINT "medical_note_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carry existing notes over: individual entries, then each cat in a group entry.
INSERT INTO "medical_note" ("shift_report_id", "cat_id", "note", "created_at")
SELECT "shift_report_id", "cat_id", trim("medical_notes"), "created_at"
FROM "cat_entry"
WHERE "cat_id" IS NOT NULL AND nullif(trim("medical_notes"), '') IS NOT NULL
ON CONFLICT ("shift_report_id", "cat_id") DO NOTHING;

INSERT INTO "medical_note" ("shift_report_id", "cat_id", "note", "created_at")
SELECT ce."shift_report_id", d."cat_id", trim(d."medical_notes"), ce."created_at"
FROM "group_entry_cat_detail" d
JOIN "cat_entry" ce ON ce."id" = d."cat_entry_id"
WHERE nullif(trim(d."medical_notes"), '') IS NOT NULL
ON CONFLICT ("shift_report_id", "cat_id") DO NOTHING;

ALTER TABLE "cat_entry" DROP COLUMN "medical_notes";
ALTER TABLE "group_entry_cat_detail" DROP COLUMN "medical_notes";
