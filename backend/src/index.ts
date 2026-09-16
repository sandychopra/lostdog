import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.ts";
import { prisma } from "./lib/prisma.ts";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

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
