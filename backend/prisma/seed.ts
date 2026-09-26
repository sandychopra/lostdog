import { hashPassword } from "better-auth/crypto";
import { CatStatus, DewormerStatus, KennelState, Role } from "../src/generated/prisma/enums.ts";
import { prisma } from "../src/lib/prisma.ts";

async function seedUser(email: string, password: string, role: Role, name: string) {
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: true,
      role,
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

  console.log(`Seeded ${role} user: ${email}`);
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set (see backend/.env.example)",
    );
  }
  await seedUser(adminEmail, adminPassword, Role.Admin, "Admin");

  const volunteerEmail = process.env.SEED_VOLUNTEER_EMAIL;
  const volunteerPassword = process.env.SEED_VOLUNTEER_PASSWORD;
  if (!volunteerEmail || !volunteerPassword) {
    throw new Error(
      "SEED_VOLUNTEER_EMAIL and SEED_VOLUNTEER_PASSWORD must be set (see backend/.env.example)",
    );
  }
  await seedUser(volunteerEmail, volunteerPassword, Role.Volunteer, "Volunteer");
}

async function seedRoster() {
  // Empty, ready kennels — representative of open capacity.
  await Promise.all(
    [1, 5].map((number) =>
      prisma.kennel.upsert({
        where: { number },
        update: {},
        create: { number, state: KennelState.Ready },
      }),
    ),
  );

  const kennel2 = await prisma.kennel.upsert({
    where: { number: 2 },
    update: {},
    create: { number: 2, state: KennelState.Occupied },
  });
  const kennel3 = await prisma.kennel.upsert({
    where: { number: 3 },
    update: {},
    create: { number: 3, state: KennelState.Occupied },
  });
  const kennel4 = await prisma.kennel.upsert({
    where: { number: 4 },
    update: {},
    create: { number: 4, state: KennelState.Occupied },
  });

  await prisma.cat.upsert({
    where: { id: "seed-cat-whiskers" },
    update: {},
    create: {
      id: "seed-cat-whiskers",
      name: "Whiskers",
      age: 3,
      sex: "Female",
      colorPattern: "Black and white",
      kennelId: kennel2.id,
      status: CatStatus.Available,
      dewormerStatus: DewormerStatus.Given,
    },
  });

  await prisma.cat.upsert({
    where: { id: "seed-cat-pepsi" },
    update: {},
    create: {
      id: "seed-cat-pepsi",
      name: "Pepsi",
      age: 2,
      sex: "Male",
      colorPattern: "Orange tabby",
      collarColor: "Blue",
      kennelId: kennel3.id,
      status: CatStatus.PendingAdoption,
      pickupAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      dewormerStatus: DewormerStatus.Due,
      needsProviable: true,
    },
  });

  const group = await prisma.group.upsert({
    where: { id: "seed-group-sprite-nehi" },
    update: {},
    create: {
      id: "seed-group-sprite-nehi",
      bonded: true,
      kennelId: kennel4.id,
    },
  });

  await prisma.cat.upsert({
    where: { id: "seed-cat-sprite" },
    update: {},
    create: {
      id: "seed-cat-sprite",
      name: "Sprite",
      age: 1,
      sex: "Female",
      colorPattern: "Calico",
      groupId: group.id,
      status: CatStatus.Available,
      dewormerStatus: DewormerStatus.Given,
    },
  });

  await prisma.cat.upsert({
    where: { id: "seed-cat-nehi" },
    update: {},
    create: {
      id: "seed-cat-nehi",
      name: "Nehi",
      age: 1,
      sex: "Male",
      colorPattern: "Tuxedo",
      groupId: group.id,
      status: CatStatus.Available,
      dewormerStatus: DewormerStatus.Given,
    },
  });

  console.log("Seeded roster: 5 kennels, 4 cats, 1 bonded group");
}

await seedUsers();
await seedRoster();
await prisma.$disconnect();
