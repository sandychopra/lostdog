// Finds storage objects under shift-reports/ that no Photo row references —
// left behind by a crash mid-upload or a delete that exhausted its retries —
// and, with --apply, deletes them. Objects newer than 24h are skipped so an
// upload in flight (object written, row not yet committed) is never touched.
//   bun run storage:reconcile           # report only
//   bun run storage:reconcile --apply   # delete
import { prisma } from "../lib/prisma.ts";
import { storage } from "../lib/storage.ts";
import { photoStorageKeys } from "../lib/storageDeletes.ts";

const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const apply = process.argv.includes("--apply");

const photos = await prisma.photo.findMany({ select: { storageKey: true, thumbnailKey: true } });
const referenced = new Set(photoStorageKeys(photos));
const cutoff = Date.now() - MIN_AGE_MS;

let scanned = 0;
const orphans: string[] = [];
for await (const object of storage.list("shift-reports/")) {
  scanned++;
  if (!referenced.has(object.key) && object.lastModified.getTime() < cutoff) {
    orphans.push(object.key);
  }
}

for (const key of orphans) {
  console.log(`${apply ? "deleting" : "orphan"}: ${key}`);
  if (apply) await storage.delete(key);
}

console.log(
  `Scanned ${scanned} objects; ${orphans.length} orphaned${apply ? " and deleted" : " (re-run with --apply to delete)"}.`,
);
await prisma.$disconnect();
