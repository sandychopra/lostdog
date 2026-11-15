import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PhotoStorage } from "./storage.ts";

// In-memory stand-in for the one Prisma delegate the outbox uses, so these
// tests never touch a real database (same approach as notifications.test.ts).
type Row = { id: number; key: string; attempts: number; lastError: string | null };

const rows: Row[] = [];
const hooks: { afterFind?: () => void } = {};

mock.module("./prisma.ts", () => ({
  prisma: {
    pendingStorageDelete: {
      findMany: async ({ where }: { where: { attempts: { lt: number } } }) => {
        const found = rows.filter((r) => r.attempts < where.attempts.lt).map((r) => ({ ...r }));
        hooks.afterFind?.();
        return found;
      },
      delete: async ({ where }: { where: { id: number } }) => {
        rows.splice(
          rows.findIndex((r) => r.id === where.id),
          1,
        );
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: { attempts: { increment: number }; lastError: string };
      }) => {
        const row = rows.find((r) => r.id === where.id)!;
        row.attempts += data.attempts.increment;
        row.lastError = data.lastError;
      },
    },
  },
}));

const { flushPendingDeletes, photoStorageKeys, MAX_DELETE_ATTEMPTS } =
  await import("./storageDeletes.ts");

let nextId = 1;
function queue(key: string, attempts = 0): Row {
  const row = { id: nextId++, key, attempts, lastError: null };
  rows.push(row);
  return row;
}

function recordingStorage(failKeys: Set<string> = new Set()) {
  const deleted: string[] = [];
  const store = {
    async delete(key: string) {
      if (failKeys.has(key)) throw new Error("bucket unreachable");
      deleted.push(key);
    },
  } as unknown as PhotoStorage;
  return { store, deleted };
}

beforeEach(() => {
  rows.length = 0;
  hooks.afterFind = undefined;
});

describe("flushPendingDeletes", () => {
  test("deletes queued objects and removes their rows", async () => {
    queue("a.jpg");
    queue("a.jpg.thumb.jpg");
    const { store, deleted } = recordingStorage();

    await flushPendingDeletes(store);

    expect(deleted).toEqual(["a.jpg", "a.jpg.thumb.jpg"]);
    expect(rows).toEqual([]);
  });

  test("records a failure and retries it on the next flush", async () => {
    const row = queue("a.jpg");
    const failing = new Set(["a.jpg"]);
    const { store, deleted } = recordingStorage(failing);

    await flushPendingDeletes(store);
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe("bucket unreachable");

    failing.clear();
    await flushPendingDeletes(store);
    expect(deleted).toEqual(["a.jpg"]);
    expect(rows).toEqual([]);
  });

  test("gives up on a key after the max attempts", async () => {
    queue("stuck.jpg", MAX_DELETE_ATTEMPTS);
    const { store, deleted } = recordingStorage();

    await flushPendingDeletes(store);

    expect(deleted).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  test("a call during a flush reruns it instead of overlapping", async () => {
    queue("first.jpg");
    const { store, deleted } = recordingStorage();
    let concurrent: Promise<void> | undefined;
    hooks.afterFind = () => {
      hooks.afterFind = undefined;
      queue("second.jpg");
      concurrent = flushPendingDeletes(store);
    };

    await flushPendingDeletes(store);
    await concurrent;

    expect(deleted).toEqual(["first.jpg", "second.jpg"]);
  });
});

test("photoStorageKeys includes thumbnails only when present", () => {
  expect(
    photoStorageKeys([
      { storageKey: "a.jpg", thumbnailKey: "a.jpg.thumb.jpg" },
      { storageKey: "b.heic", thumbnailKey: null },
    ]),
  ).toEqual(["a.jpg", "a.jpg.thumb.jpg", "b.heic"]);
});
