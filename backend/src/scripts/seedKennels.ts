import { KennelState } from "shared/constants/kennelState.ts";
import { logActivity } from "../lib/activityLog.ts";
import { prisma } from "../lib/prisma.ts";

// Creates the shelter's physical kennels (1–8) as empty, Ready kennels. Safe for
// production, unlike `bun run seed`, which also creates demo cats and accounts.
// Idempotent: kennels that already exist are left untouched, whatever their
// state or occupants. See docs/deployment.md. From backend/:
//
//   bun run seed-kennels

const KENNEL_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const created: number[] = [];
const existing: number[] = [];

try {
  for (const number of KENNEL_NUMBERS) {
    const wasCreated = await prisma.$transaction(async (tx) => {
      if (await tx.kennel.findUnique({ where: { number }, select: { id: true } })) return false;
      const kennel = await tx.kennel.create({ data: { number, state: KennelState.Ready } });
      await logActivity(tx, {
        entityType: "Kennel",
        entityId: kennel.id,
        action: "Create",
        actorId: null,
        description: `Kennel ${number} created`,
      });
      return true;
    });
    (wasCreated ? created : existing).push(number);
  }

  const list = (numbers: number[]) => (numbers.length ? numbers.join(", ") : "none");
  console.log(`Created kennels: ${list(created)}. Already present: ${list(existing)}.`);
} finally {
  await prisma.$disconnect();
}
