import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import type { Prisma } from "../generated/prisma/client.ts";

/** Reports that involve a cat: its own entry, a group entry it belongs to, or a meet & greet / play group tag. */
export function reportsInvolvingCat(catId: number): Prisma.ShiftReportWhereInput {
  return {
    OR: [
      { catEntries: { some: { catId } } },
      { catEntries: { some: { groupDetails: { some: { catId } } } } },
      { catEntries: { some: { group: { cats: { some: { id: catId } } } } } },
      { meetAndGreets: { some: { cats: { some: { catId } } } } },
      { playGroups: { some: { cats: { some: { catId } } } } },
    ],
  };
}

export const submittedOnly: Prisma.ShiftReportWhereInput = {
  status: ShiftReportStatus.Submitted,
};

/** Parses a positive-integer query param; undefined if absent, null if present but invalid. */
export function parseIdParam(raw: unknown): number | undefined | null {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Parses a YYYY-MM-DD query param; undefined if absent, null if present but invalid. */
export function parseDateParam(raw: unknown): Date | undefined | null {
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** limit/offset with a default of 50 and a cap of 200. */
export function parsePaging(query: Record<string, unknown>): { take: number; skip: number } {
  const limit = Number(query.limit);
  const offset = Number(query.offset);
  return {
    take: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50,
    skip: Number.isInteger(offset) && offset > 0 ? offset : 0,
  };
}
