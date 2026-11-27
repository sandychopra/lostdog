import { describe, expect, test } from "bun:test";
import { changeCatStatusSchema, returnToRccSchema } from "./catStatus.ts";
import { createCatSchema, updateCatSchema, updateGroupedCatSchema } from "./cats.ts";
import { createGroupSchema } from "./groups.ts";
import { createKennelMoveRequestSchema } from "./kennelMoveRequests.ts";
import { updateKennelSchema } from "./kennels.ts";
import {
  createManualNotificationSchema,
  dismissNotificationSchema,
  notificationCommentSchema,
} from "./notifications.ts";
import { updatePhotoTagsSchema } from "./photos.ts";
import { createUserSchema, updateUserSchema } from "./users.ts";

const messages = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("cat schemas", () => {
  const cat = {
    name: "  Biscuit ",
    sex: "Male",
    colorPattern: "Tabby",
    dewormerStatus: "NotNeeded",
    needsProbiotic: false,
  };

  test("blank optional form fields become undefined", () => {
    const parsed = createCatSchema.parse({
      ...cat,
      ageYears: "",
      ageMonths: "",
      collarColor: " ",
      microchipNumber: "",
      dewormerDueDate: "",
      pickupAt: "",
      kennelId: "",
    });

    expect(parsed).toMatchObject({
      name: "Biscuit",
      ageYears: undefined,
      ageMonths: undefined,
      collarColor: undefined,
      microchipNumber: undefined,
      dewormerDueDate: undefined,
      pickupAt: undefined,
      kennelId: undefined,
    });
  });

  test.each(["12", "-1", "1.5"])("rejects %p months", (ageMonths) => {
    expect(createCatSchema.safeParse({ ...cat, ageMonths }).success).toBe(false);
  });

  test("a whitespace-only name is required", () => {
    expect(messages(createCatSchema.safeParse({ ...cat, name: "   " }))).toContain(
      "Name is required",
    );
  });

  test("editing an ungrouped cat requires a kennel; creating one doesn't", () => {
    expect(createCatSchema.safeParse(cat).success).toBe(true);
    expect(messages(updateCatSchema.safeParse({ ...cat, kennelId: "" }))).toContain(
      "Kennel is required",
    );
  });

  test("editing a grouped cat ignores kennelId", () => {
    const parsed = updateGroupedCatSchema.parse({ ...cat, kennelId: 5 });
    expect("kennelId" in parsed).toBe(false);
  });

  test("a due dewormer needs a due date on update too", () => {
    const result = updateCatSchema.safeParse({ ...cat, kennelId: 1, dewormerStatus: "Due" });
    expect(messages(result)).toContain("Due date is required when the dewormer is due");
  });
});

describe("changeCatStatusSchema", () => {
  test("Picked Up is not a direct status target", () => {
    expect(changeCatStatusSchema.safeParse({ status: "PickedUp" }).success).toBe(false);
  });

  test("an explicit null pickup stays null rather than becoming 1970", () => {
    expect(changeCatStatusSchema.parse({ status: "Adopted", pickupAt: null }).pickupAt).toBeNull();
  });

  test("a blank pickup is omitted", () => {
    expect(
      changeCatStatusSchema.parse({ status: "Adopted", pickupAt: "" }).pickupAt,
    ).toBeUndefined();
  });

  test("rejects an unparseable pickup", () => {
    expect(
      messages(changeCatStatusSchema.safeParse({ status: "Adopted", pickupAt: "soon" })),
    ).toContain("Invalid date");
  });

  test("a blank return reason becomes undefined", () => {
    expect(returnToRccSchema.parse({ reason: "  " }).reason).toBeUndefined();
  });
});

describe("createGroupSchema", () => {
  test("needs at least two distinct cats", () => {
    expect(messages(createGroupSchema.safeParse({ catIds: [1], kennelId: 1 }))).toContain(
      "Select at least 2 cats",
    );
    expect(messages(createGroupSchema.safeParse({ catIds: [1, 1], kennelId: 1 }))).toContain(
      "Cats must be distinct",
    );
  });

  test("bonded only on exactly two cats", () => {
    expect(createGroupSchema.safeParse({ catIds: [1, 2], kennelId: 1, bonded: true }).success).toBe(
      true,
    );
    expect(
      messages(createGroupSchema.safeParse({ catIds: [1, 2, 3], kennelId: 1, bonded: true })),
    ).toContain("Bonded can only be set on a group of exactly two cats");
  });

  test("bonded defaults to false", () => {
    expect(createGroupSchema.parse({ catIds: ["1", "2"], kennelId: "4" })).toEqual({
      catIds: [1, 2],
      kennelId: 4,
      bonded: false,
    });
  });
});

describe("createKennelMoveRequestSchema", () => {
  const move = { fromKennelId: 1, toKennelId: 2 };

  test("needs exactly one of a cat or a group", () => {
    expect(createKennelMoveRequestSchema.safeParse({ ...move, catId: 3 }).success).toBe(true);
    expect(messages(createKennelMoveRequestSchema.safeParse(move))).toContain(
      "Exactly one of catId or groupId is required",
    );
    expect(
      messages(createKennelMoveRequestSchema.safeParse({ ...move, catId: 3, groupId: 4 })),
    ).toContain("Exactly one of catId or groupId is required");
  });

  test("the destination must differ from the source", () => {
    const result = createKennelMoveRequestSchema.safeParse({
      catId: 3,
      fromKennelId: 1,
      toKennelId: "1",
    });
    expect(messages(result)).toContain(
      "Destination kennel must be different from the source kennel",
    );
  });

  test("an unselected destination is rejected", () => {
    expect(
      createKennelMoveRequestSchema.safeParse({ ...move, catId: 3, toKennelId: "" }).success,
    ).toBe(false);
  });
});

describe("kennel schemas", () => {
  test("an Admin may set a kennel to Planned", () => {
    expect(updateKennelSchema.safeParse({ number: 3, state: "Planned" }).success).toBe(true);
  });

  test.each(["0", "-2", "2.5", ""])("rejects kennel number %p", (number) => {
    expect(updateKennelSchema.safeParse({ number, state: "Ready" }).success).toBe(false);
  });
});

describe("manual notification schemas", () => {
  test("a message is required when there are no steps", () => {
    expect(
      messages(createManualNotificationSchema.safeParse({ title: "Hi", message: "  " })),
    ).toContain("Message is required when there are no tasks");
  });

  test("steps alone are enough, and keep their order", () => {
    const parsed = createManualNotificationSchema.parse({
      title: "Prep",
      tasks: [
        { actionType: "ResetKennel", kennelId: "5" },
        { actionType: "MoveCat", kennelId: "5", catId: "1" },
        { actionType: "FreeText", description: "Sweep" },
      ],
    });

    expect(parsed.tasks.map((t) => t.actionType)).toEqual(["ResetKennel", "MoveCat", "FreeText"]);
  });

  test("a move step needs exactly one of a cat or a group", () => {
    const result = createManualNotificationSchema.safeParse({
      title: "Prep",
      tasks: [{ actionType: "MoveCat", kennelId: 5 }],
    });
    expect(messages(result)).toContain("Move steps need exactly one of a cat or group");
  });

  test("a free-text step needs a description", () => {
    const result = createManualNotificationSchema.safeParse({
      title: "Prep",
      tasks: [{ actionType: "FreeText", description: " " }],
    });
    expect(messages(result)).toContain("Description is required");
  });

  test("titles are capped at 200 characters", () => {
    expect(
      createManualNotificationSchema.safeParse({ title: "x".repeat(201), message: "m" }).success,
    ).toBe(false);
  });

  test("an empty comment is allowed (it clears the comment)", () => {
    expect(notificationCommentSchema.parse({ comment: "  " }).comment).toBe("");
  });

  test("a blank dismiss note becomes undefined", () => {
    expect(dismissNotificationSchema.parse({ note: " " }).note).toBeUndefined();
  });
});

describe("updatePhotoTagsSchema", () => {
  test("an empty tag list means unassigned", () => {
    expect(updatePhotoTagsSchema.parse({}).catIds).toEqual([]);
  });

  test("rejects duplicate tags", () => {
    expect(updatePhotoTagsSchema.safeParse({ catIds: [1, 1] }).success).toBe(false);
  });
});

describe("user schemas", () => {
  const user = { name: "Sam Smith", email: "sam@example.org", role: "Volunteer" };

  test("a blank password on edit keeps the current one", () => {
    expect(updateUserSchema.parse({ ...user, password: "" }).password).toBe("");
  });

  test("a whitespace-only password on edit is rejected rather than treated as blank", () => {
    expect(updateUserSchema.safeParse({ ...user, password: "        " }).success).toBe(false);
  });

  test("a short password is rejected", () => {
    expect(messages(createUserSchema.safeParse({ ...user, password: "short" }))).toContain(
      "Password must be at least 8 characters",
    );
  });

  // Regression: passwords used to be trimmed on save but not at login.
  test("a password is stored exactly as typed", () => {
    expect(createUserSchema.parse({ ...user, password: " secret123 " }).password).toBe(
      " secret123 ",
    );
  });
});
