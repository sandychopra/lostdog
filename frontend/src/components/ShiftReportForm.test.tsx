import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

// When true, the cats are in care (Available) and Pepsi sits in kennel 4, so
// a new report pre-fills cards for Pepsi and the Sprite/Nehi group. Off by
// default so the other tests start with no cards.
let catsInCare = false;
const status = () => (catsInCare ? "Available" : "PickedUp");
// When true, Biscuit (Adopted, still in kennel 6) and Clementine (Picked Up,
// still in kennel 9) are on the roster too.
let withAdoptedAndPickedUp = false;

const get = mock(async (url: string) => {
  if (url === "/api/cats") {
    return {
      data: {
        cats: [
          {
            id: 1,
            name: "Pepsi",
            groupId: null,
            status: status(),
            kennel: catsInCare ? { id: 4, number: 4 } : null,
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
          {
            id: 2,
            name: "Sprite",
            groupId: 10,
            status: status(),
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
          {
            id: 3,
            name: "Nehi",
            groupId: 10,
            status: status(),
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
          // In care but in no kennel, so never gets a card.
          {
            id: 4,
            name: "Fanta",
            groupId: null,
            status: status(),
            kennel: null,
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
          ...(withAdoptedAndPickedUp
            ? [
                {
                  id: 5,
                  name: "Biscuit",
                  groupId: null,
                  status: "Adopted",
                  kennel: { id: 6, number: 6 },
                  dewormerStatus: "Given",
                  needsProbiotic: false,
                },
                {
                  id: 6,
                  name: "Clementine",
                  groupId: null,
                  status: "PickedUp",
                  kennel: { id: 9, number: 9 },
                  dewormerStatus: "Given",
                  needsProbiotic: false,
                },
              ]
            : []),
        ],
      },
    };
  }
  if (url === "/api/kennels") {
    return {
      data: {
        kennels: [
          ...(withAdoptedAndPickedUp
            ? [
                {
                  id: 6,
                  number: 6,
                  state: "Occupied",
                  cats: [{ id: 5, name: "Biscuit" }],
                  groups: [],
                },
                {
                  id: 9,
                  number: 9,
                  state: "Occupied",
                  cats: [{ id: 6, name: "Clementine" }],
                  groups: [],
                },
              ]
            : []),
          ...(catsInCare
            ? [
                {
                  id: 4,
                  number: 4,
                  state: "Occupied",
                  cats: [{ id: 1, name: "Pepsi" }],
                  groups: [],
                },
              ]
            : []),
          {
            id: 5,
            number: 5,
            state: "Ready",
            cats: [],
            groups: [
              {
                id: 10,
                cats: [
                  { id: 2, name: "Sprite" },
                  { id: 3, name: "Nehi" },
                ],
              },
            ],
          },
        ],
      },
    };
  }
  throw new Error(`Unexpected GET ${url}`);
});
// Lets a test hold the report save open to line up a race.
let reportSaveGate: Promise<void> | null = null;
const post = mock(async (url: string, _payload: unknown) => {
  if (url === "/api/photos") return { data: { photo: { id: 99, tags: [] } } };
  if (reportSaveGate) await reportSaveGate;
  return { data: { shiftReport: { id: 1, catEntries: [] } } };
});

const put = mock(async (_url: string, _payload: unknown) => {
  if (reportSaveGate) await reportSaveGate;
  return { data: { shiftReport: { id: 1, catEntries: [] } } };
});

mock.module("../lib/api", () => ({
  api: { get, post, put },
}));

const { default: ShiftReportForm } = await import("./ShiftReportForm");

function hidePage() {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

// A new report saves itself as a draft (POST) as soon as it opens; every
// later save — autosave or submit — updates it (PUT).
async function waitForInitialDraft() {
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post.mock.calls[0]).toEqual([
    "/api/shift-reports",
    expect.objectContaining({ status: "Draft" }),
  ]);
}

function submittedPayloads() {
  return [...post.mock.calls, ...put.mock.calls]
    .map(([, payload]) => payload as { status?: string } | undefined)
    .filter((payload) => payload?.status === "Submitted");
}

async function openEditor(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole("button", { name: `Actions for ${title}` }));
  await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
  return screen.findByRole("dialog");
}

describe("ShiftReportForm", () => {
  beforeEach(() => {
    catsInCare = false;
    withAdoptedAndPickedUp = false;
    reportSaveGate = null;
    get.mockClear();
    post.mockClear();
    put.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    mock.restore();
  });

  test("submits shift-level fields for a new report", async () => {
    const onSuccess = mock(() => {});
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={onSuccess} />);
    await waitForInitialDraft();

    await user.selectOptions(screen.getByLabelText("Shift Type"), "Evening");
    await user.type(screen.getByLabelText("Cleaning Notes"), "Swept floors");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(
      "/api/shift-reports/1",
      expect.objectContaining({
        status: "Submitted",
        shiftType: "Evening",
        cleaningNotes: "Swept floors",
        catEntries: [],
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(1));
  });

  test("shift type has no default and is required to submit", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(screen.getByLabelText("Shift Type")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    expect(await screen.findByText("Select a shift type")).toBeInTheDocument();
    expect(submittedPayloads()).toHaveLength(0);
  });

  test("split shift is disabled and cleared for a Mid-day shift", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Shift Type"), "MidDay");

    expect(screen.getByLabelText("Split shift (Morning/Evening only)")).toBeDisabled();
  });

  test("checking split shift requires picking First or Second before submitting", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Shift Type"), "Morning");
    await user.click(screen.getByLabelText("Split shift (Morning/Evening only)"));
    expect(screen.getByLabelText("Which half of the shift?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    expect(await screen.findByText("Select First or Second shift")).toBeInTheDocument();
    expect(submittedPayloads()).toHaveLength(0);
  });

  test("submits the chosen split-shift position", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Shift Type"), "Morning");
    await user.click(screen.getByLabelText("Split shift (Morning/Evening only)"));
    await user.selectOptions(screen.getByLabelText("Which half of the shift?"), "Second");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(submittedPayloads()).toHaveLength(1));
    expect(submittedPayloads()[0]).toMatchObject({
      isSplitShift: true,
      splitShiftPosition: "Second",
    });
  });

  test("individual entry has no Free-fed field, has a Most food-amount option", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByRole("combobox", { name: /add a cat/i }), [
      "cat:1",
    ]);
    await openEditor(user, "Pepsi");

    expect(screen.queryByText("Free-fed")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Most" }).length).toBeGreaterThan(0);
  });

  test("group entry has no Water noted field", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByRole("combobox", { name: /add a cat/i }), [
      "group:10",
    ]);
    await openEditor(user, "Sprite / Nehi");

    expect(screen.getByText("Fecal Score (shared)")).toBeInTheDocument();
    // Each cat's food notes is a growing text box, not a one-line input.
    expect(
      screen.getByLabelText("Food Notes", { selector: '[id$=".catDetails.0.foodNotes"]' }).tagName,
    ).toBe("TEXTAREA");
    expect(screen.queryByText("Water noted (shared)")).not.toBeInTheDocument();
  });

  test("picking a cat or group removes it from the add-entry picker", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    const picker = await screen.findByRole("combobox", { name: /add a cat/i });
    expect(within(picker).getByRole("option", { name: "Pepsi" })).toBeInTheDocument();

    await user.selectOptions(picker, ["cat:1"]);

    expect(within(picker).queryByRole("option", { name: "Pepsi" })).not.toBeInTheDocument();
  });

  test("Add Play Group opens an editor; closing it with no cats leaves no card", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Add Play Group" }));
    expect(await screen.findByRole("dialog", { name: "New play group" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByTestId("playGroups-card")).toBeNull();
  });

  test("Done with no cats tagged says why and keeps the editor open", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Add Meet & Greet" }));
    const dialog = await screen.findByRole("dialog", { name: "New meet & greet" });
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(within(dialog).getByText("Tag at least one cat")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("a play group's cats and note are set in the editor and shown on its card", async () => {
    catsInCare = true;
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Add Play Group" }));
    const dialog = await screen.findByRole("dialog", { name: "New play group" });
    await user.click(within(dialog).getByRole("button", { name: "Add cat" }));
    await user.type(await screen.findByPlaceholderText("Search cats…"), "pep");
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Pepsi" }));
    await user.keyboard("{Escape}"); // close the cat list
    await user.type(within(dialog).getByLabelText("General note (optional)"), "Zoomies");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const card = screen.getByTestId("playGroups-card");
    expect(card).toHaveTextContent("Pepsi");
    expect(card).toHaveTextContent("Zoomies");

    // Editing again comes from the card's ⋮ menu.
    await user.click(within(card).getByRole("button", { name: /^Actions for play group/ }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit play group" })).toBeInTheDocument();
  });

  test("Select all cats in a play group includes in-care cats without a card", async () => {
    catsInCare = true;
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "Add Play Group" }));
    const dialog = await screen.findByRole("dialog", { name: "New play group" });
    await user.click(within(dialog).getByRole("button", { name: "Select all cats" }));

    for (const name of ["Pepsi", "Sprite", "Nehi", "Fanta"]) {
      expect(within(dialog).getByRole("button", { name: `Remove ${name}` })).toBeInTheDocument();
    }
  });

  test("Adopted cats still in a kennel count as in care; Picked Up cats don't", async () => {
    catsInCare = true;
    withAdoptedAndPickedUp = true;
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(3));
    const cardText = screen.getAllByTestId("cat-entry-card").map((c) => c.textContent);
    expect(cardText.some((t) => t?.includes("Biscuit"))).toBe(true);
    expect(cardText.some((t) => t?.includes("Clementine"))).toBe(false);

    await user.click(screen.getByRole("button", { name: "Add Play Group" }));
    const dialog = await screen.findByRole("dialog", { name: "New play group" });
    await user.click(within(dialog).getByRole("button", { name: "Add cat" }));
    const list = await screen.findByRole("listbox");
    expect(within(list).getByRole("option", { name: "Biscuit" })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: "Clementine" })).toBeNull();
    await user.keyboard("{Escape}");

    await user.click(within(dialog).getByRole("button", { name: "Select all cats" }));
    expect(within(dialog).getByRole("button", { name: "Remove Biscuit" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Remove Clementine" })).toBeNull();

    // Chips are alphabetical.
    const chipNames = within(dialog)
      .getAllByRole("button", { name: /^Remove / })
      .map((b) => b.getAttribute("aria-label")!.replace("Remove ", ""));
    expect(chipNames).toEqual([...chipNames].sort((a, b) => a.localeCompare(b)));
    expect(chipNames[0]).toBe("Biscuit");
  });

  test("medical notes start empty; a note can be written about a cat with no Food card", async () => {
    catsInCare = true;
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(2));
    expect(screen.queryByTestId("medical-note-card")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add Medical Note" }));
    const dialog = await screen.findByRole("dialog", { name: "New medical note" });

    // Done needs a cat and a note.
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(within(dialog).getByText("Pick a cat")).toBeInTheDocument();
    expect(within(dialog).getByText("Write the note")).toBeInTheDocument();

    // Fanta is in care but in no kennel, so has no Food card.
    await user.selectOptions(within(dialog).getByLabelText("Cat"), "Fanta");
    await user.type(within(dialog).getByLabelText("Note"), "Eye drops given");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const card = screen.getByTestId("medical-note-card");
    expect(card).toHaveTextContent("Fanta");
    expect(card).toHaveTextContent("Eye drops given");

    // A cat with a note isn't offered for a second one.
    await user.click(screen.getByRole("button", { name: "Add Medical Note" }));
    const second = await screen.findByRole("dialog", { name: "New medical note" });
    expect(
      within(within(second).getByLabelText("Cat")).queryByRole("option", { name: "Fanta" }),
    ).toBeNull();
    // Closing a new note without a cat discards it.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getAllByTestId("medical-note-card")).toHaveLength(1);
  });

  test("medical notes are sent with the report, not on cat cards", async () => {
    catsInCare = true;
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(2));

    await openEditor(user, "Pepsi");
    expect(screen.queryByLabelText("Medical Notes")).toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Add Medical Note" }));
    const dialog = await screen.findByRole("dialog", { name: "New medical note" });
    await user.selectOptions(within(dialog).getByLabelText("Cat"), "Pepsi");
    await user.type(within(dialog).getByLabelText("Note"), "Sneezing");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    const payload = put.mock.calls.at(-1)?.[1] as {
      medicalNotes: unknown[];
      catEntries: Record<string, unknown>[];
    };
    expect(payload.medicalNotes).toEqual([expect.objectContaining({ catId: 1, note: "Sneezing" })]);
    expect(payload.catEntries.every((e) => !("medicalNotes" in e))).toBe(true);
  });

  test("there's no Kennel Notes field; Other Notes covers it", () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(screen.queryByLabelText("Kennel Notes")).toBeNull();
    expect(screen.getByLabelText("Other Notes")).toBeInTheDocument();
  });

  test("every kennel is listed, defaulted to its current state", async () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(await screen.findByLabelText("Kennel 5")).toHaveValue("Ready");
  });

  test("reporting a state that conflicts with the current one submits fine, no note needed", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByLabelText("Kennel 5"), "Occupied");
    await user.selectOptions(screen.getByLabelText("Shift Type"), "Morning");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(submittedPayloads()).toHaveLength(1));
    const payload = submittedPayloads()[0] as unknown as { kennelsStatus: unknown[] };
    expect(payload.kennelsStatus[0]).toMatchObject({ kennelId: 5, reportedState: "Occupied" });
  });

  test("confirming the current state submits as-is", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await screen.findByLabelText("Kennel 5");
    await user.selectOptions(screen.getByLabelText("Shift Type"), "Morning");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(submittedPayloads()).toHaveLength(1));
    const payload = submittedPayloads()[0] as unknown as { kennelsStatus: unknown[] };
    expect(payload.kennelsStatus).toHaveLength(1);
    expect(payload.kennelsStatus[0]).toMatchObject({ kennelId: 5, reportedState: "Ready" });
  });

  test("a new report pre-fills a card per kennelled cat or group, in kennel order", async () => {
    catsInCare = true;
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(2));
    const cards = screen.getAllByTestId("cat-entry-card");
    expect(cards[0]).toHaveTextContent("Pepsi");
    expect(cards[1]).toHaveTextContent("Sprite / Nehi");
    expect(within(cards[0]!).getByText("Needs info")).toBeInTheDocument();
  });

  test("untouched pre-filled cards block submit until filled in or removed", async () => {
    catsInCare = true;
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(2));
    await user.selectOptions(screen.getByLabelText("Shift Type"), "Morning");

    await user.click(screen.getByRole("button", { name: "Submit Report" }));
    expect(
      await screen.findByText("2 cats still need info — fill them in or remove the cards."),
    ).toBeInTheDocument();
    expect(submittedPayloads()).toHaveLength(0);

    // Fill in Pepsi, remove the group.
    const dialog = await openEditor(user, "Pepsi");
    await user.click(within(dialog).getByRole("button", { name: "3" }));
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Fecal: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions for Sprite / Nehi" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getAllByTestId("cat-entry-card")).toHaveLength(1));

    // The report was saved as a draft when it opened, so submitting updates it.
    await user.click(screen.getByRole("button", { name: "Submit Report" }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const payload = put.mock.calls.at(-1)?.[1] as { status: string; catEntries: unknown[] };
    expect(payload.status).toBe("Submitted");
    expect(payload.catEntries).toEqual([
      expect.objectContaining({ catId: 1, fecalScores: [3], fecalEmpty: false }),
    ]);
  });

  test("autosaves a draft when the page is hidden, and not again until something changes", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    await waitForInitialDraft();

    await user.selectOptions(screen.getByLabelText("Shift Type"), "Evening");
    hidePage();

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(
      "/api/shift-reports/1",
      expect.objectContaining({ shiftType: "Evening", status: "Draft" }),
    );

    hidePage();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(put).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  test("a new report is saved as a draft as soon as it opens, pre-fill included", async () => {
    catsInCare = true;
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await waitForInitialDraft();
    const payload = post.mock.calls[0]?.[1] as {
      catEntries: { catId?: number; groupId?: number }[];
      kennelsStatus: { kennelId: number }[];
    };
    expect(payload.catEntries).toEqual([
      expect.objectContaining({ catId: 1 }),
      expect.objectContaining({ groupId: 10 }),
    ]);
    expect(payload.kennelsStatus.map((k) => k.kennelId).sort()).toEqual([4, 5]);
  });

  test("a 409 (already has a draft) reports the conflict once and stops saving", async () => {
    const onDraftConflict = mock(() => {});
    post.mockImplementationOnce(async () => {
      throw Object.assign(new Error("Conflict"), {
        isAxiosError: true,
        response: { status: 409, data: { error: "You already have a draft in progress" } },
      });
    });
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} onDraftConflict={onDraftConflict} />);

    await waitFor(() => expect(onDraftConflict).toHaveBeenCalledTimes(1));
    await user.selectOptions(screen.getByLabelText("Shift Type"), "Evening");
    hidePage();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(post).toHaveBeenCalledTimes(1);
    expect(put).not.toHaveBeenCalled();
  });

  test("there's no Save Draft button; drafts autosave", () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
    // Shown in the sticky summary bar and again next to Submit.
    expect(screen.getAllByText("Autosaves as you go")).toHaveLength(2);
    expect(screen.getByTestId("autosave-status-bottom")).toHaveTextContent("Autosaves as you go");
  });

  test("submitting while an autosave is running uploads a queued photo only once", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);
    await waitForInitialDraft();
    await user.selectOptions(screen.getByLabelText("Shift Type"), "Morning");

    const input = document.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
    await user.upload(
      input, // GIFs skip client-side resizing, which needs a real canvas.
      new File(["x"], "cat.gif", { type: "image/gif" }),
    );

    let release!: () => void;
    reportSaveGate = new Promise((resolve) => (release = resolve));
    hidePage(); // autosave starts and stalls on the report save
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Submit Report" }));
    release();

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const photoPosts = post.mock.calls.filter(([url]) => url === "/api/photos");
    expect(photoPosts).toHaveLength(1);
    const body = photoPosts[0]![1] as FormData;
    expect(body.get("clientUploadId")).toBeTruthy();
  });
});
