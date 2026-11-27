import * as Sentry from "@sentry/bun";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";
import { prisma } from "./lib/prisma.ts";
import { notifyPending, startEmailRetryLoop } from "./lib/emailOutbox.ts";
import { flushPendingDeletes, startStorageDeleteLoop } from "./lib/storageDeletes.ts";
import { contentSecurityPolicyDirectives, serveFrontend } from "./lib/frontendHosting.ts";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth.ts";
import usersRouter from "./routes/users.ts";
import kennelsRouter from "./routes/kennels.ts";
import catsRouter from "./routes/cats.ts";
import groupsRouter from "./routes/groups.ts";
import littersRouter from "./routes/litters.ts";
import shiftReportsRouter from "./routes/shiftReports.ts";
import photosRouter from "./routes/photos.ts";
import notificationsRouter from "./routes/notifications.ts";
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

// Header the platform's edge proxy sets to the real client IP, overwriting any
// client-supplied value (Railway: X-Real-IP). An alternative to TRUST_PROXY_HOPS
// for proxies that don't send X-Forwarded-For. Only set it behind such a proxy,
// or clients could pick their own rate-limit key.
const clientIpHeader = process.env.CLIENT_IP_HEADER?.trim() || undefined;

// In dev the frontend is a different origin but the same site (localhost:3000
// vs :4000) and loads photos via fetch, so CORP "same-site" is enough. The CSP
// only matters when this server also serves the built frontend (production).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: { directives: contentSecurityPolicyDirectives() },
  }),
);

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
  ...(clientIpHeader && {
    keyGenerator: (req) => ipKeyGenerator(req.get(clientIpHeader)?.trim() || req.ip || ""),
  }),
});

app.use("/api/auth/sign-in", signInLimiter);
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

// Any successful write may have created a Notification, submitted a shift
// report, or queued storage deletes; drain those outboxes once the response is out.
app.use((req, res, next) => {
  if (req.method !== "GET") {
    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      notifyPending();
      void flushPendingDeletes();
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
app.use("/api/notifications", notificationsRouter);
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

// Production: the same server hosts the built frontend (see frontendHosting.ts).
if (process.env.FRONTEND_DIST_DIR) {
  serveFrontend(app, process.env.FRONTEND_DIST_DIR);
}

// Reports unhandled route errors to Sentry (a no-op when Sentry isn't
// initialized), then passes them on to the handler below.
Sentry.setupExpressErrorHandler(app);

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

const server = app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  startEmailRetryLoop();
  startStorageDeleteLoop();
});

// The platform sends SIGTERM when a new deploy replaces this one: stop taking
// connections and let in-flight requests (e.g. photo uploads) finish, within the
// draining window (RAILWAY_DEPLOYMENT_DRAINING_SECONDS) before SIGKILL.
process.once("SIGTERM", () => {
  console.log("SIGTERM received; shutting down");
  setTimeout(() => process.exit(0), 10_000).unref();
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
});
