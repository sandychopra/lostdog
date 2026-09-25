import type { Response } from "express";
import { z, type ZodType } from "zod";

export function validate<S extends ZodType>(
  schema: S,
  body: unknown,
  res: Response,
): z.infer<S> | undefined {
  const result = schema.safeParse(body);

  if (!result.success) {
    res.status(400).json({ error: result.error.issues.map((issue) => issue.message).join(", ") });
    return undefined;
  }

  return result.data;
}
