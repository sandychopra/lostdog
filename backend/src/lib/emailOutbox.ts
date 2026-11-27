import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import { prisma } from "./prisma.ts";
import { mailer as defaultMailer, type EmailMessage, type Mailer } from "./mailer.ts";
import {
  EMAILED_NOTIFICATION_TYPES,
  notificationEmailInclude,
  renderNotificationEmail,
  renderShiftReportEmail,
  shiftReportEmailInclude,
} from "./emailTemplates.ts";

export const MAX_EMAIL_ATTEMPTS = 5;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

let flushing = false;
let rerunRequested = false;

function describeError(error: unknown): string {
  const body = (error as { response?: { body?: unknown } })?.response?.body;
  const message = error instanceof Error ? error.message : String(error);
  return (body ? `${message}: ${JSON.stringify(body)}` : message).slice(0, 1000);
}

/**
 * Sends every notification email not yet sent. Notifications are created inside
 * many different transactions, so rather than emailing from each of them (and
 * mailing for work that later rolls back) routes call this after the commit and
 * it picks up whatever rows are still pending. Never throws: a failed send is
 * recorded on the row and retried by the interval in `startEmailRetryLoop`.
 *
 * A call made while a flush is running doesn't start a second one; it asks the
 * running flush to go round again, since its rows may have been committed after
 * that flush's queries ran.
 */
export async function flushPendingEmails(mailer: Mailer = defaultMailer): Promise<void> {
  if (flushing) {
    rerunRequested = true;
    return;
  }
  flushing = true;
  try {
    do {
      rerunRequested = false;
      try {
        await flushNotifications(mailer);
        await flushShiftReports(mailer);
      } catch (error) {
        console.error("[notifications] flush failed:", error);
      }
    } while (rerunRequested);
  } finally {
    flushing = false;
  }
}

async function attempt(
  mailer: Mailer,
  label: string,
  message: EmailMessage,
  onSent: () => Promise<unknown>,
  onFailed: (error: string) => Promise<unknown>,
) {
  try {
    await mailer.send(message);
  } catch (error) {
    const description = describeError(error);
    console.error(`[notifications] failed to send ${label}:`, description);
    await onFailed(description);
    return;
  }
  await onSent();
}

async function flushNotifications(mailer: Mailer) {
  const pending = await prisma.notification.findMany({
    where: {
      emailSent: false,
      emailAttempts: { lt: MAX_EMAIL_ATTEMPTS },
      type: { in: [...EMAILED_NOTIFICATION_TYPES] },
    },
    include: notificationEmailInclude,
    orderBy: { id: "asc" },
  });

  for (const notification of pending) {
    // Claim by bumping the attempt count first, so a crash mid-send can't loop forever.
    const claimed = await prisma.notification.updateMany({
      where: { id: notification.id, emailSent: false, emailAttempts: notification.emailAttempts },
      data: { emailAttempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    await attempt(
      mailer,
      `notification ${notification.id}`,
      renderNotificationEmail(notification),
      () =>
        prisma.notification.update({
          where: { id: notification.id },
          data: { emailSent: true, emailLastError: null },
        }),
      (error) =>
        prisma.notification.update({
          where: { id: notification.id },
          data: { emailLastError: error },
        }),
    );
  }
}

async function flushShiftReports(mailer: Mailer) {
  const pending = await prisma.shiftReport.findMany({
    where: {
      status: ShiftReportStatus.Submitted,
      emailSentAt: null,
      emailAttempts: { lt: MAX_EMAIL_ATTEMPTS },
    },
    include: shiftReportEmailInclude,
    orderBy: { id: "asc" },
  });

  for (const report of pending) {
    const claimed = await prisma.shiftReport.updateMany({
      where: { id: report.id, emailSentAt: null, emailAttempts: report.emailAttempts },
      data: { emailAttempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    await attempt(
      mailer,
      `shift report ${report.id}`,
      renderShiftReportEmail(report),
      () =>
        prisma.shiftReport.update({
          where: { id: report.id },
          data: { emailSentAt: new Date(), emailLastError: null },
        }),
      (error) =>
        prisma.shiftReport.update({ where: { id: report.id }, data: { emailLastError: error } }),
    );
  }
}

/** Fire-and-forget trigger for route handlers, to call once a response is sent. */
export function notifyPending(): void {
  void flushPendingEmails();
}

export function startEmailRetryLoop(): void {
  setInterval(() => void flushPendingEmails(), RETRY_INTERVAL_MS).unref();
}
