import { hashPassword } from "better-auth/crypto";
import {
  NotificationType,
  CatStatus,
  ChecklistActionType,
  DewormerStatus,
  KennelState,
  Role,
  SignAction,
  TaskState,
} from "../src/generated/prisma/enums.ts";
import { prisma } from "../src/lib/prisma.ts";
import {
  changeCatStatus,
  completeSignTask,
  confirmPickup,
  createCatWithArrivalNotification,
  returnCatToRcc,
} from "../src/lib/catStatus.ts";
import { markKennelNeedsReset } from "../src/lib/kennelResets.ts";
import { createKennelMoveRequest } from "../src/lib/kennelMoveRequests.ts";
import { completeChecklistAction, createChecklistTasks } from "../src/lib/kennelPrepChecklists.ts";
import { syncDewormerNotification, syncProbioticNotification } from "../src/lib/medicalAlerts.ts";

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

// Cat has no natural unique field, so re-running the seed looks the cat up by
// name and leaves it alone if found — unlike a real upsert, this won't update
// an existing row's other fields on a later run, which is fine for dev fixtures.
async function findOrCreateCat(data: {
  name: string;
  ageYears?: number;
  ageMonths?: number;
  sex: string;
  colorPattern: string;
  collarColor?: string;
  kennelId?: number;
  groupId?: number;
  status?: CatStatus;
  pickupAt?: Date;
  dewormerStatus?: DewormerStatus;
  dewormerDueDate?: Date;
  needsProbiotic?: boolean;
}) {
  const existing = await prisma.cat.findFirst({ where: { name: data.name } });
  if (existing) return existing;
  return prisma.cat.create({ data });
}

// Group has no distinguishing scalar field at all, so its identity for seeding
// purposes is "the group occupying this kennel."
async function findOrCreateGroupByKennel(kennelId: number, bonded: boolean) {
  const existing = await prisma.group.findFirst({ where: { kennelId } });
  if (existing) return existing;
  return prisma.group.create({ data: { kennelId, bonded } });
}

async function seedRoster() {
  // Empty, ready kennels — representative of open capacity. Kennel 7 starts
  // Ready too; seedNotifications() flips it to NeedsReset through the real
  // markKennelNeedsReset() helper so it also gets the notification that state
  // always implies (see seedNotifications for why that matters).
  await Promise.all(
    [1, 5, 6, 7, 8].map((number) =>
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

  await findOrCreateCat({
    name: "Whiskers",
    collarColor: "Green",
    ageYears: 3,
    ageMonths: 0,
    sex: "Female",
    colorPattern: "Black & White",
    kennelId: kennel2.id,
    status: CatStatus.Available,
    dewormerStatus: DewormerStatus.Given,
  });

  // Seeded Available; seedNotifications() drives it to PendingAdoption through
  // the real changeCatStatus() transition so it gets a proper notification +
  // sign task instead of just a status column value.
  await findOrCreateCat({
    name: "Pepsi",
    ageYears: 2,
    ageMonths: 6,
    sex: "Male",
    colorPattern: "Orange / Orange Tabby",
    collarColor: "Blue",
    kennelId: kennel3.id,
    status: CatStatus.Available,
    dewormerStatus: DewormerStatus.Due,
    dewormerDueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    needsProbiotic: true,
  });

  const group = await findOrCreateGroupByKennel(kennel4.id, true);

  await findOrCreateCat({
    name: "Sprite",
    collarColor: "Pink",
    ageYears: 0,
    ageMonths: 8,
    sex: "Female",
    colorPattern: "Calico",
    groupId: group.id,
    status: CatStatus.Available,
    dewormerStatus: DewormerStatus.Given,
  });

  await findOrCreateCat({
    name: "Nehi",
    collarColor: "Purple",
    ageYears: 0,
    ageMonths: 8,
    sex: "Male",
    colorPattern: "Tuxedo",
    groupId: group.id,
    status: CatStatus.Available,
    dewormerStatus: DewormerStatus.Given,
  });

  console.log("Seeded roster: 8 kennels, 4 cats, 1 bonded group");
}

// Exercises the real business-logic helpers (changeCatStatus, returnCatToRcc,
// etc.) rather than inserting Notification rows directly, so the seeded data
// obeys the same invariants the app enforces at runtime (e.g. a NeedsReset
// kennel always has a matching open notification, or nobody could complete
// its reset). Each scenario is guarded so re-running the seed doesn't
// duplicate it.
async function seedNotifications() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL!;
  const volunteerEmail = process.env.SEED_VOLUNTEER_EMAIL!;
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const volunteer = await prisma.user.findUniqueOrThrow({ where: { email: volunteerEmail } });

  await prisma.$transaction(async (tx) => {
    // Pending adoption: promote Pepsi (seeded Available) through the real
    // transition. Guarded on the notification existing, not the cat's status —
    // a dev database seeded before this script drove the transition properly
    // may already have Pepsi sitting at PendingAdoption with no notification
    // at all (status set directly, the old way); changeCatStatus's "already at
    // this status" branch only reschedules pickupAt and won't backfill that,
    // so force it back to Available first when that's what happened.
    const pepsi = await tx.cat.findFirstOrThrow({ where: { name: "Pepsi" } });
    const pepsiHasNotification = await tx.notification.findFirst({
      where: { catId: pepsi.id, type: NotificationType.PendingAdoption },
    });
    if (!pepsiHasNotification) {
      if (pepsi.status !== CatStatus.Available) {
        await tx.cat.update({
          where: { id: pepsi.id },
          data: { status: CatStatus.Available, pickupAt: null },
        });
      }
      await changeCatStatus(tx, {
        catId: pepsi.id,
        targetStatus: CatStatus.PendingAdoption,
        pickupAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        actorId: admin.id,
      });
    }

    // Dewormer overdue + probiotic needed: Pepsi seeds with dewormerStatus Due
    // (past due date) and needsProbiotic true, but seedRoster creates her via
    // findOrCreateCat rather than createCatWithArrivalNotification, so her
    // DewormerDue/ProbioticNeeded notifications need to be synced explicitly
    // here — same "drive it through the real helper" approach as her
    // PendingAdoption transition above. Both syncs are internally guarded
    // against duplicates, so this is safe to run on every seed pass.
    await syncDewormerNotification(tx, { catId: pepsi.id, actorId: admin.id });
    await syncProbioticNotification(tx, { catId: pepsi.id, actorId: admin.id });

    // One logged dose today, so Pepsi's ProbioticNeeded notification has a
    // non-empty dose log to render instead of always showing "Overdue" with
    // nothing underneath.
    const pepsiHasLoggedDose = await tx.probioticDose.findFirst({
      where: { catId: pepsi.id },
    });
    if (!pepsiHasLoggedDose) {
      await tx.probioticDose.create({
        data: { catId: pepsi.id, loggedById: volunteer.id },
      });
    }

    // Kennel needs reset: kennel 7 is seeded Ready — markKennelNeedsReset
    // flips it and guards its own notification against duplicates.
    const kennel7 = await tx.kennel.findUniqueOrThrow({ where: { number: 7 } });
    await markKennelNeedsReset(tx, kennel7.id);

    // New arrival, no kennel assigned yet — never resolves.
    const biscuit =
      (await tx.cat.findFirst({ where: { name: "Biscuit" } })) ??
      (await createCatWithArrivalNotification(tx, {
        name: "Biscuit",
        collarColor: "Red",
        ageYears: 0,
        ageMonths: 4,
        sex: "Male",
        colorPattern: "Ginger",
        dewormerStatus: DewormerStatus.Due,
        dewormerDueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        needsProbiotic: false,
      }));

    // Full adopted + picked-up cycle: both driving notifications resolve
    // together at pickup, each with a completed, attributed sign task.
    if (!(await tx.cat.findFirst({ where: { name: "Clementine" } }))) {
      const kennel9 = await tx.kennel.upsert({
        where: { number: 9 },
        update: {},
        create: { number: 9, state: KennelState.Occupied },
      });
      const clementine = await tx.cat.create({
        data: {
          name: "Clementine",
          collarColor: "Yellow",
          ageYears: 1,
          ageMonths: 2,
          sex: "Female",
          colorPattern: "Tortoiseshell",
          kennelId: kennel9.id,
          status: CatStatus.Available,
          dewormerStatus: DewormerStatus.Given,
        },
      });
      await changeCatStatus(tx, {
        catId: clementine.id,
        targetStatus: CatStatus.PendingAdoption,
        pickupAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        actorId: admin.id,
      });
      const pendingSign = await tx.signTask.findFirstOrThrow({
        where: { catId: clementine.id, action: SignAction.PostPending },
        orderBy: { id: "desc" },
      });
      await completeSignTask(tx, { signTaskId: pendingSign.id, actorId: volunteer.id });
      await changeCatStatus(tx, {
        catId: clementine.id,
        targetStatus: CatStatus.Adopted,
        pickupAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        actorId: admin.id,
      });
      const adoptedSign = await tx.signTask.findFirstOrThrow({
        where: { catId: clementine.id, action: SignAction.PostAdopted },
        orderBy: { id: "desc" },
      });
      await completeSignTask(tx, { signTaskId: adoptedSign.id, actorId: volunteer.id });
      await confirmPickup(tx, { catId: clementine.id, actorId: volunteer.id });
    }

    // Back available: the sign was posted, then the adoption fell through —
    // an open "remove sign" action on its BackAvailable notification.
    if (!(await tx.cat.findFirst({ where: { name: "Marble" } }))) {
      const kennel10 = await tx.kennel.upsert({
        where: { number: 10 },
        update: {},
        create: { number: 10, state: KennelState.Occupied },
      });
      const marble = await tx.cat.create({
        data: {
          name: "Marble",
          collarColor: "Light blue",
          ageYears: 4,
          ageMonths: 0,
          sex: "Male",
          colorPattern: "Gray Tabby",
          kennelId: kennel10.id,
          status: CatStatus.Available,
          dewormerStatus: DewormerStatus.Given,
        },
      });
      await changeCatStatus(tx, {
        catId: marble.id,
        targetStatus: CatStatus.PendingAdoption,
        pickupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        actorId: admin.id,
      });
      const marbleSign = await tx.signTask.findFirstOrThrow({
        where: { catId: marble.id, action: SignAction.PostPending },
        orderBy: { id: "desc" },
      });
      await completeSignTask(tx, { signTaskId: marbleSign.id, actorId: volunteer.id });
      await changeCatStatus(tx, {
        catId: marble.id,
        targetStatus: CatStatus.Available,
        actorId: admin.id,
      });
    }

    // Returned to RCC: sign was posted, then the cat came back — open
    // "remove sign" action, plus the kennel it vacated needs a reset.
    if (!(await tx.cat.findFirst({ where: { name: "Tuna" } }))) {
      const kennel11 = await tx.kennel.upsert({
        where: { number: 11 },
        update: {},
        create: { number: 11, state: KennelState.Occupied },
      });
      const tuna = await tx.cat.create({
        data: {
          name: "Tuna",
          collarColor: "Orange",
          ageYears: 6,
          ageMonths: 0,
          sex: "Female",
          colorPattern: "White",
          kennelId: kennel11.id,
          status: CatStatus.Available,
          dewormerStatus: DewormerStatus.Given,
        },
      });
      await changeCatStatus(tx, {
        catId: tuna.id,
        targetStatus: CatStatus.PendingAdoption,
        pickupAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        actorId: admin.id,
      });
      const tunaSign = await tx.signTask.findFirstOrThrow({
        where: { catId: tuna.id, action: SignAction.PostPending },
        orderBy: { id: "desc" },
      });
      await completeSignTask(tx, { signTaskId: tunaSign.id, actorId: volunteer.id });
      await returnCatToRcc(tx, {
        catId: tuna.id,
        reason: "Medical — referred back to RCC for treatment",
        actorId: admin.id,
      });
    }

    // Kennel move requested: an open request to move Whiskers, not yet acted on.
    const whiskers = await tx.cat.findFirstOrThrow({ where: { name: "Whiskers" } });
    const kennel1 = await tx.kennel.findUniqueOrThrow({ where: { number: 1 } });
    const openMove = await tx.kennelMoveRequest.findFirst({
      where: { catId: whiskers.id, state: TaskState.Open },
    });
    if (!openMove && whiskers.kennelId !== null) {
      await createKennelMoveRequest(tx, {
        catId: whiskers.id,
        fromKennelId: whiskers.kennelId,
        toKennelId: kennel1.id,
        reason: "Kennel 2 needs to be near the intake room for a new arrival",
        requestedById: admin.id,
      });
    }

    // Manual, message-only: stays open until an Admin explicitly resolves it.
    if (
      !(await tx.notification.findFirst({
        where: { type: NotificationType.Manual, title: "Front door lock sticking" },
      }))
    ) {
      await tx.notification.create({
        data: {
          type: NotificationType.Manual,
          title: "Front door lock sticking",
          message:
            "The front door deadbolt is sticking again — jiggle the key gently. Maintenance is scheduled for Monday.",
          createdById: admin.id,
        },
      });
    }

    // Manual with an ordered, mixed-type checklist: first step done (with
    // attribution), the rest locked in order — good coverage for the
    // Notifications page's word-wrap and collapse/expand behavior.
    if (
      !(await tx.notification.findFirst({
        where: { type: NotificationType.Manual, title: "Weekend deep clean" },
      }))
    ) {
      const kennel6 = await tx.kennel.findUniqueOrThrow({ where: { number: 6 } });
      const kennel8 = await tx.kennel.findUniqueOrThrow({ where: { number: 8 } });
      const checklist = await createChecklistTasks(tx, {
        createdById: admin.id,
        actions: [
          {
            actionType: ChecklistActionType.FreeText,
            description:
              "Wipe down every surface in the storage room and restock litter boxes before the next intake arrives this weekend",
          },
          { actionType: ChecklistActionType.ResetKennel, kennelId: kennel8.id },
          { actionType: ChecklistActionType.MoveCat, kennelId: kennel6.id, catId: biscuit.id },
        ],
      });
      await tx.notification.create({
        data: {
          type: NotificationType.Manual,
          title: "Weekend deep clean",
          checklistId: checklist.id,
          createdById: admin.id,
        },
      });
      await completeChecklistAction(tx, {
        checklistActionId: checklist.actions[0].id,
        actorId: volunteer.id,
      });
    }
  });

  console.log("Seeded notifications: all 10 notification types represented");
}

await seedUsers();
await seedRoster();
await seedNotifications();
await prisma.$disconnect();
