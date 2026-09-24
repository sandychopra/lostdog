import type { Request, Response, NextFunction } from "express";
import { Role } from "shared/constants/role.ts";
import type { AuthedRequest } from "./requireAuth.ts";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthedRequest).session.user.role !== Role.Admin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
