import type { ActivityAction, ActivityEntityType } from "shared/constants/activityLog.ts";
import type { Prisma } from "../generated/prisma/client.ts";

type Tx = Prisma.TransactionClient;

/**
 * Appends an audit-trail row for a Cat or Kennel mutation. Call inside the
 * same transaction as the mutation it describes so the two commit together.
 * actorId is null for changes with no acting user.
 */
export async function logActivity(
  tx: Tx,
  args: {
    entityType: ActivityEntityType;
    entityId: number;
    action: ActivityAction;
    actorId?: string | null;
    description: string;
  },
): Promise<void> {
  await tx.activityLog.create({
    data: {
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      actorId: args.actorId ?? null,
      description: args.description,
    },
  });
}

/** "field: old → new" for each listed field whose value differs, comma-joined; empty if none. */
export function describeChanges<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
): string {
  const show = (v: unknown) => (v === null || v === undefined || v === "" ? "none" : String(v));
  return fields
    .filter((f) => show(before[f]) !== show(after[f]))
    .map((f) => `${f}: ${show(before[f])} → ${show(after[f])}`)
    .join(", ");
}

/**
 * Logs a Cat's move between kennels. For a Group occupant, logs one row per
 * member Cat, since a Group has no activity history of its own. Call before or
 * after the move — the destination is passed in, not read back.
 */
export async function logOccupantMoved(
  tx: Tx,
  args: {
    catId: number | null;
    groupId: number | null;
    fromKennelId: number | null;
    toKennelId: number;
    actorId?: string | null;
  },
): Promise<void> {
  const catIds =
    args.catId !== null
      ? [args.catId]
      : (await tx.cat.findMany({ where: { groupId: args.groupId }, select: { id: true } })).map(
          (c) => c.id,
        );
  const [from, to] = await Promise.all([
    args.fromKennelId === null
      ? null
      : tx.kennel.findUnique({ where: { id: args.fromKennelId }, select: { number: true } }),
    tx.kennel.findUniqueOrThrow({ where: { id: args.toKennelId }, select: { number: true } }),
  ]);
  const description = `Moved from kennel ${from?.number ?? "none"} to kennel ${to.number}`;

  for (const catId of catIds) {
    await logActivity(tx, {
      entityType: "Cat",
      entityId: catId,
      action: "Update",
      actorId: args.actorId,
      description,
    });
  }
  await logActivity(tx, {
    entityType: "Kennel",
    entityId: args.toKennelId,
    action: "Update",
    actorId: args.actorId,
    description: `Occupant moved in from kennel ${from?.number ?? "none"}`,
  });
}
