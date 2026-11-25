import { formatFecalScore } from "shared/constants/fecalScore.ts";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { EmailMessage } from "./mailer.ts";

const catSelect = { select: { id: true, name: true } } as const;
const kennelSelect = { select: { id: true, number: true } } as const;

export const announcementEmailInclude = {
  cat: { select: { id: true, name: true, pickupAt: true, kennel: kennelSelect } },
  kennel: kennelSelect,
  createdBy: { select: { name: true } },
  checklist: {
    select: {
      actions: {
        orderBy: { order: "asc" },
        include: {
          kennel: kennelSelect,
          cat: catSelect,
          group: { select: { cats: catSelect } },
        },
      },
    },
  },
  kennelMoveRequests: {
    include: {
      cat: catSelect,
      group: { select: { cats: catSelect } },
      fromKennel: kennelSelect,
      toKennel: kennelSelect,
      requestedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.AnnouncementInclude;

export const shiftReportEmailInclude = {
  author: { select: { name: true } },
  catEntries: {
    orderBy: { id: "asc" },
    include: {
      cat: catSelect,
      group: { select: { cats: catSelect } },
      groupDetails: { include: { cat: catSelect } },
    },
  },
  meetAndGreets: { orderBy: { id: "asc" }, include: { cats: { include: { cat: catSelect } } } },
  playGroups: { orderBy: { id: "asc" }, include: { cats: { include: { cat: catSelect } } } },
  medicalNotes: { orderBy: { cat: { name: "asc" } }, include: { cat: catSelect } },
  kennelsStatus: { include: { kennel: kennelSelect } },
} satisfies Prisma.ShiftReportInclude;

export type AnnouncementForEmail = Prisma.AnnouncementGetPayload<{
  include: typeof announcementEmailInclude;
}>;
export type ShiftReportForEmail = Prisma.ShiftReportGetPayload<{
  include: typeof shiftReportEmailInclude;
}>;

// dewormer/probiotic reminders are in-app only.
export const EMAILED_ANNOUNCEMENT_TYPES = [
  AnnouncementType.NewArrival,
  AnnouncementType.PendingAdoption,
  AnnouncementType.Adopted,
  AnnouncementType.BackAvailable,
  AnnouncementType.ReturnedToRcc,
  AnnouncementType.KennelMoveRequested,
  AnnouncementType.KennelNeedsReset,
  AnnouncementType.Manual,
] as const;

const SHIFT_LABELS: Record<string, string> = {
  Morning: "Morning",
  MidDay: "Mid-day",
  Evening: "Evening",
};

function appLink(path: string): string {
  return `${process.env.FRONTEND_URL ?? ""}${path}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function names(cats: { name: string }[]): string {
  return cats.map((c) => c.name).join(", ");
}

function checklistLine(
  action: NonNullable<AnnouncementForEmail["checklist"]>["actions"][number],
  index: number,
): string {
  const prefix = `${index + 1}. `;
  switch (action.actionType) {
    case ChecklistActionType.ResetKennel:
      return `${prefix}Reset kennel ${action.kennel?.number}`;
    case ChecklistActionType.MoveCat: {
      const who = action.cat?.name ?? names(action.group?.cats ?? []);
      return `${prefix}Move ${who} to kennel ${action.kennel?.number}`;
    }
    default:
      return `${prefix}${action.description ?? ""}`;
  }
}

export function renderAnnouncementEmail(announcement: AnnouncementForEmail): EmailMessage {
  const catName = announcement.cat?.name ?? "A cat";
  const kennelNumber = announcement.cat?.kennel?.number ?? announcement.kennel?.number;
  const lines: string[] = [];
  let subject: string;

  switch (announcement.type) {
    case AnnouncementType.NewArrival:
      subject = `New arrival: ${catName}`;
      lines.push(`${catName} has arrived.`);
      if (kennelNumber !== undefined) lines.push(`Kennel: ${kennelNumber}`);
      break;
    case AnnouncementType.PendingAdoption:
    case AnnouncementType.Adopted: {
      const label = announcement.type === AnnouncementType.Adopted ? "adopted" : "pending adoption";
      subject = `${catName} is ${label}`;
      lines.push(`${catName} is now ${label}.`);
      if (kennelNumber !== undefined) lines.push(`Kennel: ${kennelNumber}`);
      if (announcement.cat?.pickupAt) {
        lines.push(`Scheduled pickup: ${formatDateTime(announcement.cat.pickupAt)}`);
      }
      break;
    }
    case AnnouncementType.BackAvailable:
      subject = `${catName} is available again`;
      lines.push(`${catName} is back available for adoption.`);
      if (kennelNumber !== undefined) lines.push(`Kennel: ${kennelNumber}`);
      break;
    case AnnouncementType.ReturnedToRcc:
      subject = `${catName} returned to RCC`;
      lines.push(`${catName} is returning to the RCC and is no longer at this location.`);
      break;
    case AnnouncementType.KennelNeedsReset:
      subject = `Kennel ${announcement.kennel?.number} needs reset`;
      lines.push(`Kennel ${announcement.kennel?.number} needs to be reset.`);
      break;
    case AnnouncementType.KennelMoveRequested: {
      const move = announcement.kennelMoveRequests[0];
      const who = move?.cat?.name ?? names(move?.group?.cats ?? []);
      subject = `Kennel move requested: ${who || catName}`;
      lines.push(
        `Move ${who || catName} from kennel ${move?.fromKennel.number} to kennel ${move?.toKennel.number}.`,
      );
      if (move?.reason) lines.push(`Reason: ${move.reason}`);
      if (move) lines.push(`Requested by: ${move.requestedBy.name}`);
      break;
    }
    case AnnouncementType.Manual:
      subject = announcement.title ?? "Announcement";
      if (announcement.message) lines.push(announcement.message);
      if (announcement.createdBy) lines.push(`Posted by: ${announcement.createdBy.name}`);
      if (announcement.checklist && announcement.checklist.actions.length > 0) {
        lines.push("", "Tasks:", ...announcement.checklist.actions.map(checklistLine));
      }
      break;
    default:
      throw new Error(`No email template for announcement type ${announcement.type}`);
  }

  lines.push("", `View in the app: ${appLink("/announcements")}`);
  return { subject, text: lines.join("\n") };
}

function field(label: string, value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return `${label}: ${typeof value === "boolean" ? (value ? "Yes" : "No") : value}`;
}

function compact(lines: (string | null)[], indent = "  "): string[] {
  return lines.filter((l): l is string => l !== null).map((l) => `${indent}${l}`);
}

export function renderShiftReportEmail(report: ShiftReportForEmail): EmailMessage {
  const shift = report.shiftType ? (SHIFT_LABELS[report.shiftType] ?? report.shiftType) : "Shift";
  const split = report.isSplitShift ? ` (split shift, ${report.splitShiftPosition})` : "";
  const subject = `Shift report: ${formatDate(report.date)} ${shift}${split} — ${report.author.name}`;

  const lines: string[] = [
    `Shift report — ${formatDate(report.date)}, ${shift}${split}`,
    `Volunteer: ${report.author.name}`,
  ];

  const sections: [string, string | null][] = [
    ["Cleaning", report.cleaningNotes],
    ["Supplies", report.suppliesNotes],
    ["Kennels", report.kennelNotes],
    ["Other", report.otherNotes],
  ];
  for (const [label, notes] of sections) {
    if (notes) lines.push("", `${label} notes:`, ...compact([notes]));
  }

  if (report.kennelsStatus.length > 0) {
    lines.push("", "Kennel status:");
    const sorted = [...report.kennelsStatus].sort((a, b) => a.kennel.number - b.kennel.number);
    for (const k of sorted) lines.push(`  Kennel ${k.kennel.number}: ${k.reportedState}`);
  }

  if (report.catEntries.length > 0) lines.push("", "Cats:");
  for (const entry of report.catEntries) {
    const shared = [
      field("Fecal score", formatFecalScore(entry)),
      field("Pee", entry.pee),
      field("Pee/poop notes", entry.peePoopNotes),
      field("Dry food", entry.dryFoodAmount),
    ];
    if (entry.entryType === CatEntryType.Group) {
      lines.push(`- Group: ${names(entry.group?.cats ?? [])}`);
      lines.push(...compact([...shared, field("Food notes", entry.foodNotes)]));
      for (const detail of entry.groupDetails) {
        lines.push(
          `  ${detail.cat.name}:`,
          ...compact(
            [field("Wet food", detail.wetFoodAmount), field("Food notes", detail.foodNotes)],
            "    ",
          ),
        );
      }
    } else {
      lines.push(`- ${entry.cat?.name ?? "Unknown cat"}`);
      lines.push(
        ...compact([
          ...shared,
          field("Wet food", entry.wetFoodAmount),
          field("Food notes", entry.foodNotes),
        ]),
      );
    }
  }

  if (report.medicalNotes.length > 0) {
    lines.push("", "Medical notes:");
    for (const m of report.medicalNotes) lines.push(`- ${m.cat.name}: ${m.note}`);
  }

  if (report.meetAndGreets.length > 0) {
    lines.push("", "Meet & greets:");
    for (const mg of report.meetAndGreets) {
      lines.push(`- ${names(mg.cats.map((c) => c.cat))}${mg.note ? `: ${mg.note}` : ""}`);
    }
  }
  if (report.playGroups.length > 0) {
    lines.push("", "Play groups:");
    for (const pg of report.playGroups) {
      lines.push(`- ${names(pg.cats.map((c) => c.cat))}${pg.note ? `: ${pg.note}` : ""}`);
    }
  }

  lines.push(
    "",
    `Photos are not included; view the full report in the app: ${appLink(`/shift-reports/${report.id}`)}`,
  );
  return { subject, text: lines.join("\n") };
}
