import express, { type NextFunction, type Request, type Response, type Router } from "express";
import type { AddressInfo } from "node:net";

/**
 * A stand-in for requireAuth: the signed-in user comes from test headers
 * (`x-test-user-id`, `x-test-user-role`) instead of a Better Auth session, so
 * route tests can exercise object-level authorization without a database.
 * Register it with `mock.module("../middleware/requireAuth.ts", ...)`.
 */
export function fakeRequireAuth(req: Request, res: Response, next: NextFunction) {
  const id = req.header("x-test-user-id");
  if (!id) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as Request & { session: unknown }).session = {
    user: { id, role: req.header("x-test-user-role") ?? "Volunteer", deletedAt: null },
    session: { id: `session-${id}` },
  };
  next();
}

/** Mounts one router on a throwaway server and returns a fetch helper bound to it. */
export async function serveRouter(path: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;

  async function call(
    method: string,
    url: string,
    as: { id: string; role: "Volunteer" | "Admin" } | null,
    body?: unknown,
  ) {
    const response = await fetch(`http://127.0.0.1:${port}${path}${url}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(as && { "x-test-user-id": as.id, "x-test-user-role": as.role }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : undefined };
  }

  return { call, close: () => server.close() };
}
