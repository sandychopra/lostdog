import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";
import { prisma } from "./lib/prisma.ts";
import { requireAuth, type AuthedRequest } from "./middleware/requireAuth.ts";
import usersRouter from "./routes/users.ts";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: process.env.FRONTEND_URL!,
    credentials: true,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skip: () => !isProduction,
});

app.all("/api/auth/*splat", authLimiter, toNodeHandler(auth));

app.use(express.json());

app.get("/api/me", requireAuth, (req, res) => {
  res.json((req as AuthedRequest).session);
});

app.use("/api/users", usersRouter);

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
