import { prisma } from "./prisma.ts";
import { storage as defaultStorage, type PhotoStorage } from "./storage.ts";
import type { Prisma } from "../generated/prisma/client.ts";

// Past this, a key is left for `bun run storage:reconcile` to sweep up.
export const MAX_DELETE_ATTEMPTS = 10;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

let flushing = false;
let rerunRequested = false;

/** Every storage object a set of Photo rows points at. */
export function photoStorageKeys(
  photos: { storageKey: string; thumbnailKey: string | null }[],
): string[] {
  return photos.flatMap((p) => (p.thumbnailKey ? [p.storageKey, p.thumbnailKey] : [p.storageKey]));
}

/**
 * Call inside the transaction that deletes the rows owning these keys, so the
 * files are queued for deletion if and only if the rows are really gone.
 */
export async function queueStorageDeletes(
  tx: Prisma.TransactionClient,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  await tx.pendingStorageDelete.createMany({ data: keys.map((key) => ({ key })) });
}

/**
 * Deletes every queued storage object. Never throws: a failed delete is
 * recorded on the row and retried by `startStorageDeleteLoop`. Same
 * single-flight/rerun handling as `flushPendingEmails`.
 */
export async function flushPendingDeletes(store: PhotoStorage = defaultStorage): Promise<void> {
  if (flushing) {
    rerunRequested = true;
    return;
  }
  flushing = true;
  try {
    do {
      rerunRequested = false;
      try {
        const pending = await prisma.pendingStorageDelete.findMany({
          where: { attempts: { lt: MAX_DELETE_ATTEMPTS } },
          orderBy: { id: "asc" },
        });
        for (const row of pending) {
          try {
            await store.delete(row.key);
            await prisma.pendingStorageDelete.delete({ where: { id: row.id } });
          } catch (error) {
            const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
            console.error(`[storage] delete of ${row.key} failed:`, message);
            await prisma.pendingStorageDelete.update({
              where: { id: row.id },
              data: { attempts: { increment: 1 }, lastError: message },
            });
          }
        }
      } catch (error) {
        console.error("[storage] delete flush failed:", error);
      }
    } while (rerunRequested);
  } finally {
    flushing = false;
  }
}

export function startStorageDeleteLoop(): void {
  void flushPendingDeletes();
  setInterval(() => void flushPendingDeletes(), RETRY_INTERVAL_MS).unref();
}
