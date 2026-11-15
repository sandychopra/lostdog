import { Router, type Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import type { Readable } from "node:stream";
import { updatePhotoTagsSchema } from "shared/schemas/photos.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { Role } from "shared/constants/role.ts";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.ts";
import { validate } from "../lib/validate.ts";
import { prisma } from "../lib/prisma.ts";
import { storage } from "../lib/storage.ts";
import { makeThumbnail, thumbnailKeyFor } from "../lib/thumbnail.ts";
import { photoStorageKeys } from "../lib/storageDeletes.ts";
import { ZipArchive } from "archiver";
import { requireAdmin } from "../middleware/requireAdmin.ts";
import { buildPhotoFilename, uniqueFilename } from "../lib/photoFilename.ts";
import { parseIdParam, parsePaging, submittedOnly } from "../lib/reportQueries.ts";
import { detectImageType, isAllowedImageType } from "../lib/imageType.ts";
import type { Prisma } from "../generated/prisma/client.ts";

const router = Router();

// Long enough to outlast a page view; the frontend re-signs on an <img> error.
const SIGNED_URL_TTL_SECONDS = 15 * 60;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

// Per-user, not per-IP: uploads are authenticated, and volunteers on a shared
// shelter connection would otherwise share one bucket.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 200,
  keyGenerator: (req) => (req as AuthedRequest).session.user.id,
});

// Stored files are served from the API origin, so a script-capable type (SVG,
// HTML) opened directly would run with the viewer's session. Uploads are
// sniffed on the way in; this also neutralizes anything stored before that.
function sendPhotoFile(
  res: Response,
  file: { stream: Readable; contentType: string },
  disposition: string,
) {
  res.setHeader(
    "Content-Type",
    isAllowedImageType(file.contentType) ? file.contentType : "application/octet-stream",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Content-Disposition", disposition);
  file.stream.pipe(res);
}

const photoInclude = {
  tags: { include: { cat: { select: { id: true, name: true } } } },
  uploadedBy: { select: { id: true, name: true } },
} as const;

function parseCatIds(raw: unknown): number[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

function buildStorageKey(shiftReportId: number, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `shift-reports/${shiftReportId}/${crypto.randomUUID()}-${safeName}`;
}

// Multipart fields arrive as plain strings, so this route validates by hand
// (shape-checking req.body/req.file) rather than through the shared `validate`
// helper, which is built around zod-parsing a JSON body.
router.post("/", requireAuth, uploadLimiter, upload.single("photo"), async (req, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No photo file uploaded" });
    return;
  }

  const contentType = detectImageType(req.file.buffer);
  if (!contentType) {
    res.status(415).json({ error: "Photo must be a JPEG, PNG, GIF, WebP, or HEIC image" });
    return;
  }

  const session = (req as AuthedRequest).session;

  const shiftReportId = Number(req.body.shiftReportId);
  if (!Number.isInteger(shiftReportId) || shiftReportId <= 0) {
    res.status(400).json({ error: "shiftReportId is required" });
    return;
  }

  const shiftReport = await prisma.shiftReport.findUnique({ where: { id: shiftReportId } });
  if (!shiftReport) {
    res.status(404).json({ error: "Shift report not found" });
    return;
  }
  if (shiftReport.authorId !== session.user.id && session.user.role !== Role.Admin) {
    res.status(403).json({ error: "Only the report's author or an Admin can add photos to it" });
    return;
  }

  let catEntryId: number | undefined;
  if (req.body.catEntryId !== undefined && req.body.catEntryId !== "") {
    catEntryId = Number(req.body.catEntryId);
    if (!Number.isInteger(catEntryId) || catEntryId <= 0) {
      res.status(400).json({ error: "Invalid catEntryId" });
      return;
    }
  }

  const catEntry =
    catEntryId !== undefined
      ? await prisma.catEntry.findUnique({ where: { id: catEntryId } })
      : null;
  if (catEntryId !== undefined && (!catEntry || catEntry.shiftReportId !== shiftReportId)) {
    res.status(404).json({ error: "Cat entry not found on this report" });
    return;
  }

  // Auto-tag the entry's own cat for an Individual entry; a Group entry has no
  // single "this entry's cat" to derive from, so the client must pass catIds.
  const tagCatIds = new Set(parseCatIds(req.body.catIds));
  if (catEntry?.entryType === CatEntryType.Individual && catEntry.catId !== null) {
    tagCatIds.add(catEntry.catId);
  }

  if (tagCatIds.size > 0) {
    const cats = await prisma.cat.findMany({ where: { id: { in: [...tagCatIds] } } });
    if (cats.length !== tagCatIds.size) {
      res.status(404).json({ error: "One or more tagged cats not found" });
      return;
    }
  }

  const key = buildStorageKey(shiftReportId, req.file.originalname);
  await storage.put(key, req.file.buffer, contentType);

  let thumbnailKey: string | null = null;
  try {
    const thumbnail = await makeThumbnail(req.file.buffer);
    await storage.put(thumbnailKeyFor(key), thumbnail, "image/jpeg");
    thumbnailKey = thumbnailKeyFor(key);
  } catch (error) {
    // Views fall back to the original; not worth failing the upload over.
    console.error(`[photos] thumbnail for ${key} failed:`, error);
  }

  let photo;
  try {
    photo = await prisma.photo.create({
      data: {
        shiftReportId,
        uploadedById: session.user.id,
        catEntryId: catEntryId ?? null,
        storageKey: key,
        thumbnailKey,
        tags: { create: [...tagCatIds].map((catId) => ({ catId })) },
      },
      include: photoInclude,
    });
  } catch (error) {
    // No row will ever point at these objects; remove them now rather than
    // leaving them for the reconcile script.
    await Promise.allSettled(
      photoStorageKeys([{ storageKey: key, thumbnailKey }]).map((k) => storage.delete(k)),
    );
    throw error;
  }

  res.status(201).json({ photo });
});

const browseInclude = {
  ...photoInclude,
  shiftReport: { select: { id: true, date: true, shiftType: true } },
} as const;

// `?catId=` → photos tagged with that cat; `?unassigned=true` → photos with no
// tags; neither → all. Submitted reports only, newest first.
function browseWhere(query: Record<string, unknown>): Prisma.PhotoWhereInput | null {
  const catId = parseIdParam(query.catId);
  if (catId === null) return null;
  const tagFilter: Prisma.PhotoWhereInput =
    query.unassigned === "true"
      ? { tags: { none: {} } }
      : catId !== undefined
        ? { tags: { some: { catId } } }
        : {};
  return { AND: [{ shiftReport: submittedOnly }, tagFilter] };
}

router.get("/", requireAuth, async (req, res: Response) => {
  const where = browseWhere(req.query);
  if (!where) {
    res.status(400).json({ error: "Invalid catId" });
    return;
  }

  const photos = await prisma.photo.findMany({
    where,
    include: browseInclude,
    orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
    ...parsePaging(req.query),
  });

  res.json({ photos });
});

// Admin-only bulk download of the original files matching the same filter as
// the browse view. Declared before "/:id/..." routes for clarity.
router.get("/download-zip", requireAuth, requireAdmin, async (req, res: Response) => {
  const where = browseWhere(req.query);
  if (!where) {
    res.status(400).json({ error: "Invalid catId" });
    return;
  }

  const photos = await prisma.photo.findMany({
    where,
    include: browseInclude,
    orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
  });
  if (photos.length === 0) {
    res.status(404).json({ error: "No photos match this filter" });
    return;
  }

  const archive = new ZipArchive({ zlib: { level: 1 } });
  archive.on("error", () => res.destroy());
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="photos.zip"');
  archive.pipe(res);

  const used = new Set<string>();
  for (const photo of photos) {
    const file = await storage.get(photo.storageKey);
    if (!file) continue;
    const name = uniqueFilename(
      buildPhotoFilename({
        date: photo.shiftReport.date,
        shiftType: photo.shiftReport.shiftType,
        catNames: photo.tags.map((t) => t.cat.name),
        storageKey: photo.storageKey,
      }),
      used,
    );
    archive.append(file.stream, { name });
  }
  await archive.finalize();
});

router.get("/:id/download", requireAuth, requireAdmin, async (req, res: Response) => {
  const id = Number(req.params.id);

  const photo = await prisma.photo.findUnique({ where: { id }, include: browseInclude });
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const file = await storage.get(photo.storageKey);
  if (!file) {
    res.status(404).json({ error: "Photo file not found in storage" });
    return;
  }

  const name = buildPhotoFilename({
    date: photo.shiftReport.date,
    shiftType: photo.shiftReport.shiftType,
    catNames: photo.tags.map((t) => t.cat.name),
    storageKey: photo.storageKey,
  });
  sendPhotoFile(res, file, `attachment; filename="${name}"`);
});

// `?size=thumb` → the small copy (falling back to the original for photos
// without one); anything else → the original.
function viewKey(
  photo: { storageKey: string; thumbnailKey: string | null },
  size: unknown,
): string {
  return size === "thumb" ? (photo.thumbnailKey ?? photo.storageKey) : photo.storageKey;
}

// A short-lived direct-from-bucket URL, so image bytes skip the API entirely.
// `{ url: null }` means storage can't sign (local disk in dev): use /file.
router.get("/:id/url", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const url = await storage.signedUrl(viewKey(photo, req.query.size), SIGNED_URL_TTL_SECONDS);
  res.json({ url });
});

router.get("/:id/file", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const file = await storage.get(viewKey(photo, req.query.size));
  if (!file) {
    res.status(404).json({ error: "Photo file not found in storage" });
    return;
  }

  sendPhotoFile(res, file, "inline");
});

router.put("/:id/tags", requireAuth, async (req, res: Response) => {
  const id = Number(req.params.id);
  const session = (req as AuthedRequest).session;

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  if (photo.uploadedById !== session.user.id && session.user.role !== Role.Admin) {
    res.status(403).json({ error: "Only the uploader or an Admin can edit this photo's tags" });
    return;
  }

  const data = validate(updatePhotoTagsSchema, req.body, res);
  if (!data) return;

  if (data.catIds.length > 0) {
    const cats = await prisma.cat.findMany({ where: { id: { in: data.catIds } } });
    if (cats.length !== data.catIds.length) {
      res.status(404).json({ error: "One or more cats not found" });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.photoCatTag.deleteMany({ where: { photoId: id } });
    if (data.catIds.length > 0) {
      await tx.photoCatTag.createMany({
        data: data.catIds.map((catId) => ({ photoId: id, catId })),
      });
    }
    return tx.photo.findUniqueOrThrow({ where: { id }, include: photoInclude });
  });

  res.json({ photo: updated });
});

export default router;
