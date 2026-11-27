import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import { createFakeDb, type FakeDb } from "../test/fakeDb.ts";
import { fakeRequireAuth, serveRouter } from "../test/routeHarness.ts";

// Every Prisma call goes to an in-memory fake that each test swaps out, and
// requireAuth reads the user from test headers — no database, no Better Auth.
let db: FakeDb = createFakeDb();
mock.module("../lib/prisma.ts", () => ({
  prisma: new Proxy({}, { get: (_t, prop) => (db.client as Record<PropertyKey, unknown>)[prop] }),
}));
mock.module("../middleware/requireAuth.ts", () => ({ requireAuth: fakeRequireAuth }));

const { default: router } = await import("./shiftReports.ts");
const server = await serveRouter("/api/shift-reports", router);
afterAll(() => server.close());

const alice = { id: "alice", role: "Volunteer" } as const;
const bob = { id: "bob", role: "Volunteer" } as const;
const admin = { id: "admin", role: "Admin" } as const;

function seedReport(authorId: string, status: string, overrides: Record<string, unknown> = {}) {
  return db.insert("shiftReport", {
    authorId,
    status,
    date: new Date("2026-11-27T00:00:00Z"),
    updatedAt: new Date("2026-11-27T12:00:00Z"),
    ...overrides,
  });
}

const draftBody = { status: ShiftReportStatus.Draft, date: "2026-11-27" };

beforeEach(() => {
  db = createFakeDb();
});

describe("POST /api/shift-reports — one open draft per user", () => {
  test("rejects a second draft while one is open, returning its id", async () => {
    const existing = seedReport(alice.id, ShiftReportStatus.Draft);

    const res = await server.call("POST", "/", alice, draftBody);

    expect(res.status).toBe(409);
    expect(res.body.draftId).toBe(existing.id);
    expect(db.rows("shiftReport")).toHaveLength(1);
  });

  test("also rejects submitting a new report directly while a draft is open", async () => {
    seedReport(alice.id, ShiftReportStatus.Draft);

    const res = await server.call("POST", "/", alice, { shiftType: "Morning", date: "2026-11-27" });

    expect(res.status).toBe(409);
  });

  test("applies to Admins too", async () => {
    seedReport(admin.id, ShiftReportStatus.Draft);

    const res = await server.call("POST", "/", admin, draftBody);

    expect(res.status).toBe(409);
  });

  test("another user's draft doesn't block a new one", async () => {
    seedReport(bob.id, ShiftReportStatus.Draft);

    const res = await server.call("POST", "/", alice, draftBody);

    expect(res.status).toBe(201);
    expect(db.where("shiftReport", { authorId: alice.id })).toEqual([
      expect.objectContaining({ status: ShiftReportStatus.Draft, submittedAt: null }),
    ]);
  });

  test("submitted reports don't count as an open draft", async () => {
    seedReport(alice.id, ShiftReportStatus.Submitted);

    const res = await server.call("POST", "/", alice, draftBody);

    expect(res.status).toBe(201);
  });

  test("serializes creates per author with an advisory lock before checking", async () => {
    await server.call("POST", "/", alice, draftBody);

    expect(db.rawCalls).toEqual([
      expect.objectContaining({
        sql: expect.stringContaining("pg_advisory_xact_lock"),
        values: [alice.id],
      }),
    ]);
  });

  test("requires a signed-in user", async () => {
    const res = await server.call("POST", "/", null, draftBody);

    expect(res.status).toBe(401);
  });
});

describe("GET /api/shift-reports/my-draft", () => {
  test("returns the caller's own most recently edited draft", async () => {
    seedReport(alice.id, ShiftReportStatus.Draft, { updatedAt: new Date("2026-11-20T00:00:00Z") });
    const newest = seedReport(alice.id, ShiftReportStatus.Draft);
    seedReport(bob.id, ShiftReportStatus.Draft, { updatedAt: new Date("2026-12-01T00:00:00Z") });

    const res = await server.call("GET", "/my-draft", alice);

    expect(res.body.shiftReport.id).toBe(newest.id);
  });

  test("returns null when the caller has no draft", async () => {
    seedReport(bob.id, ShiftReportStatus.Draft);
    seedReport(alice.id, ShiftReportStatus.Submitted);

    const res = await server.call("GET", "/my-draft", alice);

    expect(res.body).toEqual({ shiftReport: null });
  });
});

describe("PUT /api/shift-reports/:id — author or Admin", () => {
  test("another volunteer can't edit the report", async () => {
    const report = seedReport(alice.id, ShiftReportStatus.Draft);

    const res = await server.call("PUT", `/${report.id}`, bob, draftBody);

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/shift-reports/:id", () => {
  test("an author can discard their own draft", async () => {
    const report = seedReport(alice.id, ShiftReportStatus.Draft);

    const res = await server.call("DELETE", `/${report.id}`, alice);

    expect(res.status).toBe(200);
    expect(db.rows("shiftReport")).toHaveLength(0);
  });

  test("an author can't delete their own submitted report", async () => {
    const report = seedReport(alice.id, ShiftReportStatus.Submitted);

    const res = await server.call("DELETE", `/${report.id}`, alice);

    expect(res.status).toBe(403);
    expect(db.rows("shiftReport")).toHaveLength(1);
  });

  test("a volunteer can't discard someone else's draft", async () => {
    const report = seedReport(bob.id, ShiftReportStatus.Draft);

    const res = await server.call("DELETE", `/${report.id}`, alice);

    expect(res.status).toBe(403);
    expect(db.rows("shiftReport")).toHaveLength(1);
  });

  test("an Admin can delete any submitted report, queuing its photo files for the storage outbox", async () => {
    const report = seedReport(alice.id, ShiftReportStatus.Submitted);
    db.insert("photo", {
      shiftReportId: report.id,
      storageKey: "a.jpg",
      thumbnailKey: "a_thumb.jpg",
    });
    db.insert("photo", { shiftReportId: report.id, storageKey: "b.jpg", thumbnailKey: null });
    db.insert("photo", { shiftReportId: 999, storageKey: "other.jpg", thumbnailKey: null });

    const res = await server.call("DELETE", `/${report.id}`, admin);

    expect(res.status).toBe(200);
    expect(db.rows("shiftReport")).toHaveLength(0);
    expect(db.rows("pendingStorageDelete").map((r) => r.key)).toEqual([
      "a.jpg",
      "a_thumb.jpg",
      "b.jpg",
    ]);
  });

  test("returns 404 for a missing report", async () => {
    const res = await server.call("DELETE", "/12345", admin);

    expect(res.status).toBe(404);
  });
});
