-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Volunteer', 'Admin');

-- CreateEnum
CREATE TYPE "CatStatus" AS ENUM ('Available', 'PendingAdoption', 'Adopted');

-- CreateEnum
CREATE TYPE "DewormerStatus" AS ENUM ('Due', 'Given');

-- CreateEnum
CREATE TYPE "KennelState" AS ENUM ('Ready', 'Occupied', 'NeedsReset');

-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('Morning', 'MidDay', 'Evening');

-- CreateEnum
CREATE TYPE "CatEntryType" AS ENUM ('Individual', 'Group');

-- CreateEnum
CREATE TYPE "FoodAmount" AS ENUM ('None', 'Some', 'All');

-- CreateEnum
CREATE TYPE "SnackTreat" AS ENUM ('Churu', 'Greenies', 'Other');

-- CreateEnum
CREATE TYPE "ChecklistActionType" AS ENUM ('ResetKennel', 'MoveCat');

-- CreateEnum
CREATE TYPE "SignAction" AS ENUM ('PostPending', 'PostAdopted', 'RemovePending');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('NewArrival', 'PendingAdoption', 'Adopted', 'BackAvailable', 'ReturnedToRcc', 'ChecklistAssigned', 'KennelMoveRequested');

-- CreateEnum
CREATE TYPE "TaskState" AS ENUM ('Open', 'Done', 'Cancelled');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'Volunteer',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "sex" TEXT NOT NULL,
    "color_pattern" TEXT NOT NULL,
    "collar_color" TEXT,
    "microchip_number" TEXT,
    "kennel_id" INTEGER,
    "group_id" INTEGER,
    "status" "CatStatus" NOT NULL DEFAULT 'Available',
    "pickup_at" TIMESTAMP(3),
    "dewormer_status" "DewormerStatus" NOT NULL DEFAULT 'Due',
    "needs_proviable" BOOLEAN NOT NULL DEFAULT false,
    "litter_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "inactive_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group" (
    "id" SERIAL NOT NULL,
    "bonded" BOOLEAN NOT NULL DEFAULT false,
    "kennel_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "litter" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "litter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kennel" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "state" "KennelState" NOT NULL DEFAULT 'Ready',

    CONSTRAINT "kennel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_report" (
    "id" SERIAL NOT NULL,
    "author_id" TEXT NOT NULL,
    "shift_type" "ShiftType" NOT NULL,
    "date" DATE NOT NULL,
    "is_split_shift" BOOLEAN NOT NULL DEFAULT false,
    "cleaning_notes" TEXT,
    "supplies_notes" TEXT,
    "play_notes" TEXT,
    "other_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_report_kennel_reset" (
    "shift_report_id" INTEGER NOT NULL,
    "kennel_id" INTEGER NOT NULL,

    CONSTRAINT "shift_report_kennel_reset_pkey" PRIMARY KEY ("shift_report_id","kennel_id")
);

-- CreateTable
CREATE TABLE "cat_entry" (
    "id" SERIAL NOT NULL,
    "shift_report_id" INTEGER NOT NULL,
    "entry_type" "CatEntryType" NOT NULL,
    "cat_id" INTEGER,
    "group_id" INTEGER,
    "fecal_score" INTEGER,
    "pee" BOOLEAN NOT NULL DEFAULT false,
    "pee_poo_notes" TEXT,
    "dry_food_amount" "FoodAmount",
    "food_notes" TEXT,
    "other_notes" TEXT,
    "free_fed" BOOLEAN,
    "water_noted" BOOLEAN,
    "wet_food_amount" "FoodAmount",
    "wet_food_brand" TEXT,
    "snack_treat" "SnackTreat",
    "snack_treat_note" TEXT,
    "medical_notes" TEXT,
    "dewormer_given" BOOLEAN NOT NULL DEFAULT false,
    "proviable_given" BOOLEAN NOT NULL DEFAULT false,
    "behavior_notes" TEXT,
    "nail_trim" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cat_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_entry_cat_detail" (
    "id" SERIAL NOT NULL,
    "cat_entry_id" INTEGER NOT NULL,
    "cat_id" INTEGER NOT NULL,
    "wet_food_amount" "FoodAmount",
    "wet_food_brand" TEXT,
    "snack_treat" "SnackTreat",
    "snack_treat_note" TEXT,
    "food_notes" TEXT,
    "medical_notes" TEXT,
    "dewormer_given" BOOLEAN NOT NULL DEFAULT false,
    "proviable_given" BOOLEAN NOT NULL DEFAULT false,
    "behavior_notes" TEXT,
    "other_notes" TEXT,
    "nail_trim" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "group_entry_cat_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo" (
    "id" SERIAL NOT NULL,
    "shift_report_id" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cat_entry_id" INTEGER,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_cat_tag" (
    "photo_id" INTEGER NOT NULL,
    "cat_id" INTEGER NOT NULL,

    CONSTRAINT "photo_cat_tag_pkey" PRIMARY KEY ("photo_id","cat_id")
);

-- CreateTable
CREATE TABLE "meet_and_greet" (
    "id" SERIAL NOT NULL,
    "shift_report_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meet_and_greet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meet_and_greet_cat" (
    "meet_and_greet_id" INTEGER NOT NULL,
    "cat_id" INTEGER NOT NULL,

    CONSTRAINT "meet_and_greet_cat_pkey" PRIMARY KEY ("meet_and_greet_id","cat_id")
);

-- CreateTable
CREATE TABLE "shift_report_play_cat" (
    "shift_report_id" INTEGER NOT NULL,
    "cat_id" INTEGER NOT NULL,

    CONSTRAINT "shift_report_play_cat_pkey" PRIMARY KEY ("shift_report_id","cat_id")
);

-- CreateTable
CREATE TABLE "kennel_prep_checklist" (
    "id" SERIAL NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kennel_prep_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_action" (
    "id" SERIAL NOT NULL,
    "checklist_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "action_type" "ChecklistActionType" NOT NULL,
    "kennel_id" INTEGER NOT NULL,
    "cat_id" INTEGER,
    "group_id" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_by_id" TEXT,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "checklist_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "id" SERIAL NOT NULL,
    "type" "AnnouncementType" NOT NULL,
    "cat_id" INTEGER,
    "checklist_id" INTEGER,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_task" (
    "id" SERIAL NOT NULL,
    "cat_id" INTEGER NOT NULL,
    "kennel_id" INTEGER NOT NULL,
    "action" "SignAction" NOT NULL,
    "announcement_id" INTEGER NOT NULL,
    "state" "TaskState" NOT NULL DEFAULT 'Open',
    "completed_by_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_on_report_id" INTEGER,

    CONSTRAINT "sign_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kennel_move_request" (
    "id" SERIAL NOT NULL,
    "cat_id" INTEGER,
    "group_id" INTEGER,
    "from_kennel_id" INTEGER NOT NULL,
    "to_kennel_id" INTEGER NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "state" "TaskState" NOT NULL DEFAULT 'Open',
    "completed_by_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_on_report_id" INTEGER,
    "announcement_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kennel_move_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_user_id_idx" ON "account"("user_id");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "cat_kennel_id_idx" ON "cat"("kennel_id");

-- CreateIndex
CREATE INDEX "cat_group_id_idx" ON "cat"("group_id");

-- CreateIndex
CREATE INDEX "cat_litter_id_idx" ON "cat"("litter_id");

-- CreateIndex
CREATE INDEX "group_kennel_id_idx" ON "group"("kennel_id");

-- CreateIndex
CREATE UNIQUE INDEX "kennel_number_key" ON "kennel"("number");

-- CreateIndex
CREATE INDEX "shift_report_author_id_idx" ON "shift_report"("author_id");

-- CreateIndex
CREATE INDEX "shift_report_date_idx" ON "shift_report"("date");

-- CreateIndex
CREATE INDEX "cat_entry_shift_report_id_idx" ON "cat_entry"("shift_report_id");

-- CreateIndex
CREATE INDEX "cat_entry_cat_id_idx" ON "cat_entry"("cat_id");

-- CreateIndex
CREATE INDEX "cat_entry_group_id_idx" ON "cat_entry"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_entry_cat_detail_cat_entry_id_cat_id_key" ON "group_entry_cat_detail"("cat_entry_id", "cat_id");

-- CreateIndex
CREATE INDEX "photo_shift_report_id_idx" ON "photo"("shift_report_id");

-- CreateIndex
CREATE INDEX "photo_cat_entry_id_idx" ON "photo"("cat_entry_id");

-- CreateIndex
CREATE INDEX "meet_and_greet_shift_report_id_idx" ON "meet_and_greet"("shift_report_id");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_action_checklist_id_order_key" ON "checklist_action"("checklist_id", "order");

-- CreateIndex
CREATE INDEX "announcement_cat_id_idx" ON "announcement"("cat_id");

-- CreateIndex
CREATE INDEX "announcement_checklist_id_idx" ON "announcement"("checklist_id");

-- CreateIndex
CREATE INDEX "sign_task_cat_id_idx" ON "sign_task"("cat_id");

-- CreateIndex
CREATE INDEX "sign_task_announcement_id_idx" ON "sign_task"("announcement_id");

-- CreateIndex
CREATE INDEX "kennel_move_request_cat_id_idx" ON "kennel_move_request"("cat_id");

-- CreateIndex
CREATE INDEX "kennel_move_request_group_id_idx" ON "kennel_move_request"("group_id");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat" ADD CONSTRAINT "cat_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat" ADD CONSTRAINT "cat_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat" ADD CONSTRAINT "cat_litter_id_fkey" FOREIGN KEY ("litter_id") REFERENCES "litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group" ADD CONSTRAINT "group_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report" ADD CONSTRAINT "shift_report_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_kennel_reset" ADD CONSTRAINT "shift_report_kennel_reset_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_kennel_reset" ADD CONSTRAINT "shift_report_kennel_reset_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_entry" ADD CONSTRAINT "cat_entry_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_entry" ADD CONSTRAINT "cat_entry_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_entry" ADD CONSTRAINT "cat_entry_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_entry_cat_detail" ADD CONSTRAINT "group_entry_cat_detail_cat_entry_id_fkey" FOREIGN KEY ("cat_entry_id") REFERENCES "cat_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_entry_cat_detail" ADD CONSTRAINT "group_entry_cat_detail_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_cat_entry_id_fkey" FOREIGN KEY ("cat_entry_id") REFERENCES "cat_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_cat_tag" ADD CONSTRAINT "photo_cat_tag_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_cat_tag" ADD CONSTRAINT "photo_cat_tag_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meet_and_greet" ADD CONSTRAINT "meet_and_greet_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meet_and_greet_cat" ADD CONSTRAINT "meet_and_greet_cat_meet_and_greet_id_fkey" FOREIGN KEY ("meet_and_greet_id") REFERENCES "meet_and_greet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meet_and_greet_cat" ADD CONSTRAINT "meet_and_greet_cat_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_play_cat" ADD CONSTRAINT "shift_report_play_cat_shift_report_id_fkey" FOREIGN KEY ("shift_report_id") REFERENCES "shift_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_report_play_cat" ADD CONSTRAINT "shift_report_play_cat_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_prep_checklist" ADD CONSTRAINT "kennel_prep_checklist_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "kennel_prep_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "kennel_prep_checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_task" ADD CONSTRAINT "sign_task_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_task" ADD CONSTRAINT "sign_task_kennel_id_fkey" FOREIGN KEY ("kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_task" ADD CONSTRAINT "sign_task_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_task" ADD CONSTRAINT "sign_task_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_task" ADD CONSTRAINT "sign_task_completed_on_report_id_fkey" FOREIGN KEY ("completed_on_report_id") REFERENCES "shift_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_cat_id_fkey" FOREIGN KEY ("cat_id") REFERENCES "cat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_from_kennel_id_fkey" FOREIGN KEY ("from_kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_to_kennel_id_fkey" FOREIGN KEY ("to_kennel_id") REFERENCES "kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_completed_on_report_id_fkey" FOREIGN KEY ("completed_on_report_id") REFERENCES "shift_report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint
-- Prisma can't express CHECK constraints in schema.prisma, so these are hand-added.
-- Exactly one of cat_id/group_id must be set on a CatEntry, matching entry_type.
ALTER TABLE "cat_entry" ADD CONSTRAINT "cat_entry_type_target_check" CHECK (
  ("entry_type" = 'Individual' AND "cat_id" IS NOT NULL AND "group_id" IS NULL) OR
  ("entry_type" = 'Group' AND "group_id" IS NOT NULL AND "cat_id" IS NULL)
);

-- CheckConstraint
-- Exactly one of cat_id/group_id must be set on a KennelMoveRequest — the occupant being moved.
ALTER TABLE "kennel_move_request" ADD CONSTRAINT "kennel_move_request_target_check" CHECK (
  ("cat_id" IS NOT NULL AND "group_id" IS NULL) OR
  ("cat_id" IS NULL AND "group_id" IS NOT NULL)
);

-- CheckConstraint
-- cat_id/group_id are only used for a MoveCat action, and at most one of them is set.
ALTER TABLE "checklist_action" ADD CONSTRAINT "checklist_action_type_target_check" CHECK (
  ("action_type" = 'ResetKennel' AND "cat_id" IS NULL AND "group_id" IS NULL) OR
  ("action_type" = 'MoveCat' AND (
    ("cat_id" IS NOT NULL AND "group_id" IS NULL) OR
    ("cat_id" IS NULL AND "group_id" IS NOT NULL)
  ))
);
