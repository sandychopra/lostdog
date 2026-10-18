import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";
import { prisma } from "./lib/prisma.ts";
import { notifyPending, startEmailRetryLoop } from "./lib/notifications.ts";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth.ts";
import usersRouter from "./routes/users.ts";
import kennelsRouter from "./routes/kennels.ts";
import catsRouter from "./routes/cats.ts";
import groupsRouter from "./routes/groups.ts";
import littersRouter from "./routes/litters.ts";
import shiftReportsRouter from "./routes/shiftReports.ts";
import photosRouter from "./routes/photos.ts";
import announcementsRouter from "./routes/announcements.ts";
import signTasksRouter from "./routes/signTasks.ts";
import kennelMoveRequestsRouter from "./routes/kennelMoveRequests.ts";
import kennelPrepChecklistsRouter from "./routes/kennelPrepChecklists.ts";
import activityLogRouter from "./routes/activityLog.ts";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const isProduction = process.env.NODE_ENV === "production";

// Number of reverse-proxy hops in front of the app (e.g. 1 behind a platform
// load balancer), so req.ip — and therefore rate limiting — sees the real
// client. Never `true`: that trusts a client-supplied X-Forwarded-For.
if (process.env.TRUST_PROXY_HOPS) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
}

// The frontend is a different origin but the same site (localhost:3000 vs
// :4000 in dev), and loads photos via fetch, so CORP "same-site" is enough.
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

app.use(
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);

// Only sign-in attempts are brute-forceable; limiting all of /api/auth/* would
// also count the get-session call the frontend makes on every page load.
const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => !isProduction,
});

app.use("/api/auth/sign-in", signInLimiter);
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Any successful write may have created an Announcement or submitted a shift
// report; send whatever email is now pending once the response is out.
app.use((req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode < 400) notifyPending();
    });
  }
  next();
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json((req as AuthedRequest).session);
});

app.use("/api/users", usersRouter);
app.use("/api/kennels", kennelsRouter);
app.use("/api/cats", catsRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/litters", littersRouter);
app.use("/api/shift-reports", shiftReportsRouter);
app.use("/api/activity-log", activityLogRouter);
app.use("/api/photos", photosRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/sign-tasks", signTasksRouter);
app.use("/api/kennel-move-requests", kennelMoveRequestsRouter);
app.use("/api/kennel-prep-checklists", kennelPrepChecklistsRouter);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

// Last resort for anything a route didn't handle (e.g. Prisma rejecting a NaN
// id): log it, but never send stack traces or Prisma messages to the client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  startEmailRetryLoop();
});
