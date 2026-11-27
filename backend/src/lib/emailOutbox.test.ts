import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EmailMessage, Mailer } from "./mailer.ts";

// An in-memory stand-in for the two Prisma delegates the outbox uses, so these
// tests never touch (or send the backlog of) a real database.
type Row = Record<string, unknown> & { id: number };

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
      const c = condition as { lt?: number; in?: unknown[] };
      if (c.lt !== undefined) return (value as number) < c.lt;
      if (c.in !== undefined) return c.in.includes(value);
    }
    return value === condition;
  });
}

function apply(row: Row, data: Record<string, unknown>) {
  for (const [key, change] of Object.entries(data)) {
    const increment = (change as { increment?: number } | null)?.increment;
    row[key] = increment !== undefined ? (row[key] as number) + increment : change;
  }
}

function fakeDelegate(rows: Row[], hooks: { afterFind?: () => void }) {
  return {
    findMany: async ({ where }: { where: Record<string, unknown> }) => {
      const found = rows
        .filter((r) => matches(r, where))
        .sort((a, b) => a.id - b.id)
        .map((r) => ({ ...r }));
      hooks.afterFind?.();
      return found;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) apply(r, data);
      return { count: hit.length };
    },
    update: async ({ where, data }: { where: { id: number }; data: Row }) => {
      const row = rows.find((r) => r.id === where.id)!;
      apply(row, data);
      return row;
    },
  };
}

const notifications: Row[] = [];
const shiftReports: Row[] = [];
const hooks: { afterFind?: () => void } = {};

mock.module("./prisma.ts", () => ({
  prisma: {
    notification: fakeDelegate(notifications, hooks),
    shiftReport: fakeDelegate(shiftReports, hooks),
  },
}));

const { flushPendingEmails, MAX_EMAIL_ATTEMPTS } = await import("./emailOutbox.ts");

let nextId = 1;

function addNotification(overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: nextId++,
    type: "Manual",
    title: "Deep clean",
    message: "Please help",
    cat: null,
    kennel: null,
    createdBy: null,
    checklist: null,
    kennelMoveRequests: [],
    emailSent: false,
    emailAttempts: 0,
    emailLastError: null,
    ...overrides,
  };
  notifications.push(row);
  return row;
}

function addShiftReport(overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: nextId++,
    status: "Submitted",
    shiftType: "Morning",
    date: new Date("2026-10-20T00:00:00Z"),
    isSplitShift: false,
    splitShiftPosition: null,
    cleaningNotes: null,
    suppliesNotes: null,
    otherNotes: null,
    author: { name: "Sam" },
    catEntries: [],
    meetAndGreets: [],
    playGroups: [],
    medicalNotes: [],
    kennelsStatus: [],
    emailSentAt: null,
    emailAttempts: 0,
    emailLastError: null,
    ...overrides,
  };
  shiftReports.push(row);
  return row;
}

function recordingMailer(onSend?: (message: EmailMessage) => void | Promise<void>) {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = {
    async send(message) {
      await onSend?.(message);
      sent.push(message);
    },
  };
  return { mailer, sent };
}

const failingMailer: Mailer = {
  async send() {
    throw new Error("SendGrid down");
  },
};

beforeEach(() => {
  notifications.length = 0;
  shiftReports.length = 0;
  hooks.afterFind = undefined;
});

describe("flushPendingEmails", () => {
  test("emails pending notifications of emailed types and marks them sent", async () => {
    const pending = addNotification({ title: "Deep clean" });
    const alreadySent = addNotification({ title: "Old news", emailSent: true });
    const inAppOnly = addNotification({ type: "DewormerDue", title: null });
    const { mailer, sent } = recordingMailer();

    await flushPendingEmails(mailer);

    expect(sent.map((m) => m.subject)).toEqual(["Deep clean"]);
    expect(pending.emailSent).toBe(true);
    expect(pending.emailAttempts).toBe(1);
    expect(alreadySent.emailAttempts).toBe(0);
    expect(inAppOnly.emailSent).toBe(false);
    expect(inAppOnly.emailAttempts).toBe(0);
  });

  test("emails only submitted shift reports, once", async () => {
    const submitted = addShiftReport();
    const draft = addShiftReport({ status: "Draft" });
    const { mailer, sent } = recordingMailer();

    await flushPendingEmails(mailer);
    await flushPendingEmails(mailer);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain("Shift report: 2026-10-20 Morning");
    expect(submitted.emailSentAt).toBeInstanceOf(Date);
    expect(draft.emailSentAt).toBeNull();
    expect(draft.emailAttempts).toBe(0);
  });

  test("records a failed send and retries it on the next flush", async () => {
    const notification = addNotification();
    const report = addShiftReport();

    await flushPendingEmails(failingMailer);

    expect(notification.emailSent).toBe(false);
    expect(notification.emailAttempts).toBe(1);
    expect(notification.emailLastError).toBe("SendGrid down");
    expect(report.emailSentAt).toBeNull();
    expect(report.emailLastError).toBe("SendGrid down");

    const { mailer, sent } = recordingMailer();
    await flushPendingEmails(mailer);

    expect(sent).toHaveLength(2);
    expect(notification.emailSent).toBe(true);
    expect(notification.emailAttempts).toBe(2);
    expect(notification.emailLastError).toBeNull();
    expect(report.emailLastError).toBeNull();
  });

  test("gives up after MAX_EMAIL_ATTEMPTS failures", async () => {
    const notification = addNotification();

    for (let i = 0; i < MAX_EMAIL_ATTEMPTS + 2; i++) await flushPendingEmails(failingMailer);
    expect(notification.emailAttempts).toBe(MAX_EMAIL_ATTEMPTS);

    const { mailer, sent } = recordingMailer();
    await flushPendingEmails(mailer);
    expect(sent).toHaveLength(0);
    expect(notification.emailSent).toBe(false);
  });

  test("skips a row another process claimed after it was read", async () => {
    const notification = addNotification();
    hooks.afterFind = () => {
      // e.g. a second backend instance claimed and sent it between our read and claim.
      notification.emailAttempts = 1;
      notification.emailSent = true;
    };
    const { mailer, sent } = recordingMailer();

    await flushPendingEmails(mailer);

    expect(sent).toHaveLength(0);
    expect(notification.emailAttempts).toBe(1);
  });

  test("a flush requested mid-flush still sends rows created after the running one read", async () => {
    addNotification({ title: "First" });
    let triggered = false;
    const { mailer, sent } = recordingMailer(async () => {
      if (triggered) return;
      triggered = true;
      // A write commits a new notification while the first email is being sent,
      // and its route asks for a flush.
      addNotification({ title: "Second" });
      await flushPendingEmails(mailer);
    });

    await flushPendingEmails(mailer);

    expect(sent.map((m) => m.subject)).toEqual(["First", "Second"]);
    expect(notifications.every((a) => a.emailSent)).toBe(true);
  });
});
