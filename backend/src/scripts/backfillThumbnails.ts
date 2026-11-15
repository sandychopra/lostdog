// Generates thumbnails for photos uploaded before thumbnails existed (or whose
// thumbnail failed). Safe to re-run: only rows with no thumbnailKey are touched.
//   bun run backfill-thumbnails
import { buffer } from "node:stream/consumers";
import { prisma } from "../lib/prisma.ts";
import { storage } from "../lib/storage.ts";
import { makeThumbnail, thumbnailKeyFor } from "../lib/thumbnail.ts";

const photos = await prisma.photo.findMany({
  where: { thumbnailKey: null },
  select: { id: true, storageKey: true },
  orderBy: { id: "asc" },
});

let done = 0;
let failed = 0;
for (const photo of photos) {
  try {
    const file = await storage.get(photo.storageKey);
    if (!file) throw new Error("original missing from storage");
    const thumbnailKey = thumbnailKeyFor(photo.storageKey);
    await storage.put(thumbnailKey, await makeThumbnail(await buffer(file.stream)), "image/jpeg");
    await prisma.photo.update({ where: { id: photo.id }, data: { thumbnailKey } });
    done++;
  } catch (error) {
    failed++;
    console.error(`photo ${photo.id} (${photo.storageKey}):`, error);
  }
}

console.log(`Thumbnails: ${done} generated, ${failed} failed, ${photos.length} candidates.`);
await prisma.$disconnect();
