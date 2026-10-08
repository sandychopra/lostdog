-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('Cat', 'Kennel');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('Create', 'Update', 'Delete');

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "entity_type" "ActivityEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "actor_id" TEXT,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_created_at_idx" ON "activity_log"("entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
