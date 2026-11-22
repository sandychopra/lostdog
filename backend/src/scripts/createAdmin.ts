import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";
import { createUserSchema } from "shared/schemas/users.ts";
import { Role } from "../generated/prisma/enums.ts";
import { prisma } from "../lib/prisma.ts";
import { createUserWithPassword } from "../lib/users.ts";

// One-time bootstrap for a fresh production database (which never gets the demo
// seed): creates the first Admin, who then adds everyone else from the Users
// page. Refuses once any active Admin exists, so it can't quietly mint another
// one later. See docs/deployment.md. From backend/:
//
//   bun run create-admin --email you@example.org --name "Your Name"
//
// The password comes from ADMIN_PASSWORD if set; otherwise a random one is
// generated and printed once (change it from the Users page after signing in).

const USAGE = 'Usage: bun run create-admin --email <email> --name "<full name>"';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" } },
});

const generatedPassword = process.env.ADMIN_PASSWORD ? null : randomBytes(18).toString("base64url");

const parsed = createUserSchema.safeParse({
  name: values.name ?? "",
  email: values.email ?? "",
  password: process.env.ADMIN_PASSWORD ?? generatedPassword,
  role: Role.Admin,
});
if (!parsed.success) fail(`${z.prettifyError(parsed.error)}\n\n${USAGE}`);
const input = parsed.data;

try {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.Admin, deletedAt: null },
    select: { email: true },
  });
  if (existingAdmin) {
    fail(
      `An active Admin already exists (${existingAdmin.email}); add users from the app's Users page instead.`,
    );
  }
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    fail(`A user with email ${input.email} already exists.`);
  }

  await createUserWithPassword(input);

  console.log(`Created Admin ${input.name} <${input.email}>.`);
  if (generatedPassword) {
    console.log(`Temporary password (shown only once): ${generatedPassword}`);
  }
} finally {
  await prisma.$disconnect();
}
