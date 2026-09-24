import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.ts";

export interface AuthedRequest extends Request {
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });

  if (!session) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (session.user.deletedAt) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  (req as AuthedRequest).session = session;
  next();
}
