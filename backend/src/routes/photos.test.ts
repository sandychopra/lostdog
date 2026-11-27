import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { createFakeDb, type FakeDb } from "../test/fakeDb.ts";
import { fakeRequireAuth, serveRouter } from "../test/routeHarness.ts";

// In-memory Prisma and header-based auth; storage is never called by DELETE
// (files go through the PendingStorageDelete outbox), so nothing leaves the process.
let db: FakeDb = createFakeDb();
mock.module("../lib/prisma.ts", () => ({
  prisma: new Proxy({}, { get: (_t, prop) => (db.client as Record<PropertyKey, unknown>)[prop] }),
}));
mock.module("../middleware/requireAuth.ts", () => ({ requireAuth: fakeRequireAuth }));

const { default: router } = await import("./photos.ts");
const server = await serveRouter("/api/photos", router);
afterAll(() => server.close());

const uploader = { id: "uploader", role: "Volunteer" } as const;
const otherVolunteer = { id: "other", role: "Volunteer" } as const;
const admin = { id: "admin", role: "Admin" } as const;

let photoId: number;

beforeEach(() => {
  db = createFakeDb();
  photoId = db.insert("photo", {
    shiftReportId: 1,
    uploadedById: uploader.id,
    storageKey: "photos/1.jpg",
    thumbnailKey: "photos/1_thumb.jpg",
  }).id;
});

describe("DELETE /api/photos/:id — uploader or Admin", () => {
  test("the uploader can delete their photo and both files are queued for deletion", async () => {
    const res = await server.call("DELETE", `/${photoId}`, uploader);

    expect(res.status).toBe(200);
    expect(db.rows("photo")).toHaveLength(0);
    expect(db.rows("pendingStorageDelete").map((r) => r.key)).toEqual([
      "photos/1.jpg",
      "photos/1_thumb.jpg",
    ]);
  });

  test("an Admin can delete anyone's photo", async () => {
    const res = await server.call("DELETE", `/${photoId}`, admin);

    expect(res.status).toBe(200);
    expect(db.rows("photo")).toHaveLength(0);
  });

  test("another volunteer can't delete it, and nothing is queued", async () => {
    const res = await server.call("DELETE", `/${photoId}`, otherVolunteer);

    expect(res.status).toBe(403);
    expect(db.rows("photo")).toHaveLength(1);
    expect(db.rows("pendingStorageDelete")).toHaveLength(0);
  });

  test("returns 404 for a missing photo", async () => {
    const res = await server.call("DELETE", "/9999", admin);

    expect(res.status).toBe(404);
  });

  test("requires a signed-in user", async () => {
    const res = await server.call("DELETE", `/${photoId}`, null);

    expect(res.status).toBe(401);
  });
});

describe("Admin-only downloads", () => {
  test("a volunteer can't download an original", async () => {
    const res = await server.call("GET", `/${photoId}/download`, uploader);

    expect(res.status).toBe(403);
  });

  test("a volunteer can't download a zip", async () => {
    const res = await server.call("GET", "/download-zip", uploader);

    expect(res.status).toBe(403);
  });
});
