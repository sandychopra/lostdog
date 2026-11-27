import { describe, expect, test } from "bun:test";
import type { Response } from "express";
import { z } from "zod";
import { validate } from "./validate.ts";

function fakeResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number("Age must be a number"),
});

describe("validate", () => {
  test("returns the parsed (coerced) data and leaves the response alone", () => {
    const res = fakeResponse();

    const data = validate(schema, { name: "Pepsi", age: "3" }, res as unknown as Response);

    expect(data).toEqual({ name: "Pepsi", age: 3 });
    expect(res.body).toBeUndefined();
  });

  test("responds 400 with every issue message joined, and returns undefined", () => {
    const res = fakeResponse();

    const data = validate(schema, { name: "", age: "x" }, res as unknown as Response);

    expect(data).toBeUndefined();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Name is required, Age must be a number" });
  });

  test("rejects a missing body", () => {
    const res = fakeResponse();

    expect(validate(schema, undefined, res as unknown as Response)).toBeUndefined();
    expect(res.statusCode).toBe(400);
  });
});
