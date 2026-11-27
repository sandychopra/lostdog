import { formatFecalScore } from "shared/constants/fecalScore.ts";
import { NotificationType } from "shared/constants/notificationType.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import type { Prisma } from "../generated/prisma/client.ts";
import type { EmailMessage } from "./mailer.ts";

const catSelect = { select: { id: true, name: true } } as const;
const kennelSelect = { select: { id: true, number: true } } as const;

export const notificationEmailInclude = {
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
} satisfies Prisma.NotificationInclude;

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

export type NotificationForEmail = Prisma.NotificationGetPayload<{
  include: typeof notificationEmailInclude;
}>;
export type ShiftReportForEmail = Prisma.ShiftReportGetPayload<{
  include: typeof shiftReportEmailInclude;
}>;

// dewormer/probiotic reminders are in-app only.
export const EMAILED_NOTIFICATION_TYPES = [
  NotificationType.NewArrival,
  NotificationType.PendingAdoption,
  NotificationType.Adopted,
  NotificationType.BackAvailable,
  NotificationType.ReturnedToRcc,
  NotificationType.PickedUp,
  NotificationType.KennelMoveRequested,
  NotificationType.KennelNeedsReset,
  NotificationType.Manual,
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
  action: NonNullable<NotificationForEmail["checklist"]>["actions"][number],
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

export function renderNotificationEmail(notification: NotificationForEmail): EmailMessage {
  const catName = notification.cat?.name ?? "A cat";
  const kennelNumber = notification.cat?.kennel?.number ?? notification.kennel?.number;
  const lines: string[] = [];
  let subject: string;

  switch (notification.type) {
    case NotificationType.NewArrival:
      subject = `New arrival: ${catName}`;
      lines.push(`${catName} has arrived.`);
      if (kennelNumber !== undefined) lines.push(`Kennel: ${kennelNumber}`);
      break;
    case NotificationType.PendingAdoption:
    case NotificationType.Adopted: {
      const label = notification.type === NotificationType.Adopted ? "adopted" : "pending adoption";
      subject = `${catName} is ${label}`;
      lines.push(`${catName} is now ${label}.`);
      if (kennelNumber !== undefined) lines.push(`Kennel: ${kennelNumber}`);
      if (notification.cat?.pickupAt) {
        lines.push(`Scheduled pickup: ${formatDateTime(notification.cat.pickupAt)}`);
      }
      break;
    }
    case NotificationType.BackAvailable:
      subject = `${catName} is available again`;
      lines.push(`${catName} is back available for adoption.`);
      if (kennelNumber !== undefined) lines.push(`Kennel: ${kennelNumber}`);
      break;
    case NotificationType.ReturnedToRcc:
      subject = `${catName} returned to RCC`;
      lines.push(`${catName} is returning to the RCC and is no longer at this location.`);
      break;
    case NotificationType.PickedUp:
      subject = `${catName} has been picked up`;
      lines.push(`${catName} has been picked up by their adopter and has left the shelter.`);
      break;
    case NotificationType.KennelNeedsReset:
      subject = `Kennel ${notification.kennel?.number} needs reset`;
      lines.push(`Kennel ${notification.kennel?.number} needs to be reset.`);
      break;
    case NotificationType.KennelMoveRequested: {
      const move = notification.kennelMoveRequests[0];
      const who = move?.cat?.name ?? names(move?.group?.cats ?? []);
      subject = `Kennel move requested: ${who || catName}`;
      lines.push(
        `Move ${who || catName} from kennel ${move?.fromKennel.number} to kennel ${move?.toKennel.number}.`,
      );
      if (move?.reason) lines.push(`Reason: ${move.reason}`);
      if (move) lines.push(`Requested by: ${move.requestedBy.name}`);
      break;
    }
    case NotificationType.Manual:
      subject = notification.title ?? "Announcement";
      if (notification.message) lines.push(notification.message);
      if (notification.createdBy) lines.push(`Posted by: ${notification.createdBy.name}`);
      if (notification.checklist && notification.checklist.actions.length > 0) {
        lines.push("", "Tasks:", ...notification.checklist.actions.map(checklistLine));
      }
      break;
    default:
      throw new Error(`No email template for notification type ${notification.type}`);
  }

  lines.push("", `View in the app: ${appLink("/notifications")}`);
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
