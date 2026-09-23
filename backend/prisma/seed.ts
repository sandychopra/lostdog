import { hashPassword } from "better-auth/crypto";
import { Role } from "../src/generated/prisma/enums.ts";
import { prisma } from "../src/lib/prisma.ts";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set (see backend/.env.example)",
    );
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: Role.Admin,
      active: true,
    },
    create: {
      id: crypto.randomUUID(),
      name: "Admin",
      email,
      emailVerified: true,
      role: Role.Admin,
      active: true,
    },
  });

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    });
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashedPassword,
      },
    });
  }

  console.log(`Seeded admin user: ${email}`);
}

await seedAdmin();
await prisma.$disconnect();
