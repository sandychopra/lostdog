import { describe, expect, test } from "bun:test";
import {
  renderAnnouncementEmail,
  renderShiftReportEmail,
  type AnnouncementForEmail,
  type ShiftReportForEmail,
} from "./emailTemplates.ts";
import { createMailer } from "./mailer.ts";

function announcement(overrides: Partial<AnnouncementForEmail>): AnnouncementForEmail {
  return {
    id: 1,
    type: "NewArrival",
    catId: 1,
    checklistId: null,
    kennelId: null,
    title: null,
    message: null,
    resolved: false,
    resolvedAt: null,
    resolvedById: null,
    createdById: null,
    comment: null,
    commentedAt: null,
    commentedById: null,
    emailSent: false,
    emailAttempts: 0,
    emailLastError: null,
    createdAt: new Date(),
    cat: { id: 1, name: "Pepsi", pickupAt: null, kennel: { id: 3, number: 3 } },
    kennel: null,
    createdBy: null,
    checklist: null,
    kennelMoveRequests: [],
    ...overrides,
  };
}

describe("renderAnnouncementEmail", () => {
  test("new arrival names the cat and kennel", () => {
    const { subject, text } = renderAnnouncementEmail(announcement({}));
    expect(subject).toBe("New arrival: Pepsi");
    expect(text).toContain("Kennel: 3");
  });

  test("pending adoption includes the scheduled pickup when set", () => {
    const pickupAt = new Date("2026-10-20T15:00:00Z");
    const { subject, text } = renderAnnouncementEmail(
      announcement({
        type: "PendingAdoption",
        cat: { id: 1, name: "Pepsi", pickupAt, kennel: { id: 3, number: 3 } },
      }),
    );
    expect(subject).toBe("Pepsi is pending adoption");
    expect(text).toContain("Scheduled pickup:");
  });

  test("manual announcement lists its checklist tasks", () => {
    const { subject, text } = renderAnnouncementEmail(
      announcement({
        type: "Manual",
        cat: null,
        title: "Deep clean",
        message: "Please help",
        checklist: {
          actions: [
            {
              actionType: "ResetKennel",
              kennel: { id: 2, number: 2 },
              cat: null,
              group: null,
              description: null,
            },
            {
              actionType: "FreeText",
              kennel: null,
              cat: null,
              group: null,
              description: "Restock litter",
            },
          ],
        } as unknown as AnnouncementForEmail["checklist"],
      }),
    );
    expect(subject).toBe("Deep clean");
    expect(text).toContain("1. Reset kennel 2");
    expect(text).toContain("2. Restock litter");
  });

  test("dewormer reminders have no template", () => {
    expect(() => renderAnnouncementEmail(announcement({ type: "DewormerDue" }))).toThrow();
  });
});

describe("renderShiftReportEmail", () => {
  test("outlines entries and notes, and says photos are excluded", () => {
    const report = {
      id: 9,
      date: new Date("2026-10-15T00:00:00Z"),
      shiftType: "MidDay",
      isSplitShift: false,
      splitShiftPosition: null,
      author: { name: "Sam" },
      cleaningNotes: "Mopped",
      suppliesNotes: null,
      otherNotes: null,
      kennelsStatus: [{ reportedState: "Ready", kennel: { id: 1, number: 1 } }],
      catEntries: [
        {
          entryType: "Individual",
          cat: { id: 1, name: "Pepsi" },
          group: null,
          groupDetails: [],
          fecalScores: [3],
          fecalEmpty: false,
          pee: true,
          peePoopNotes: null,
          dryFoodAmount: "All",
          wetFoodAmount: "Some",
          foodNotes: null,
        },
      ],
      medicalNotes: [{ note: "Sneezing", cat: { id: 1, name: "Pepsi" } }],
      meetAndGreets: [{ note: "Went well", cats: [{ cat: { id: 1, name: "Pepsi" } }] }],
      playGroups: [{ note: null, cats: [{ cat: { id: 1, name: "Pepsi" } }] }],
    } as unknown as ShiftReportForEmail;

    const { subject, text } = renderShiftReportEmail(report);
    expect(subject).toContain("2026-10-15 Mid-day");
    expect(text).toContain("Cleaning notes:");
    expect(text).toContain("- Pepsi");
    expect(text).toMatch(/Medical notes:\n- Pepsi: Sneezing$/m);
    expect(text).toContain("Pepsi: Went well");
    // A blank play group note leaves no dangling colon.
    expect(text).toMatch(/Play groups:\n- Pepsi$/m);
    expect(text).toContain("Photos are not included");
  });
});

describe("createMailer", () => {
  const configured = { SENDGRID_API_KEY: "SG.x", EMAIL_FROM: "a@b.c", NOTIFICATION_TO: "g@b.c" };

  test("uses SendGrid only when fully configured outside test", () => {
    expect(createMailer({ ...configured, NODE_ENV: "production" }).constructor.name).toBe(
      "SendGridMailer",
    );
    expect(createMailer({ ...configured, NODE_ENV: "test" }).constructor.name).toBe(
      "ConsoleMailer",
    );
    expect(createMailer({ NODE_ENV: "production" }).constructor.name).toBe("ConsoleMailer");
  });
});
