import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const get = mock(async (url: string) => {
  if (url === "/api/cats") {
    return {
      data: {
        cats: [
          {
            id: 1,
            name: "Pepsi",
            groupId: null,
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
          {
            id: 2,
            name: "Sprite",
            groupId: 10,
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
          {
            id: 3,
            name: "Nehi",
            groupId: 10,
            dewormerStatus: "Given",
            needsProbiotic: false,
          },
        ],
      },
    };
  }
  if (url === "/api/kennels") {
    return {
      data: {
        kennels: [
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
const post = mock(async (_url: string, _payload: unknown) => ({
  data: { shiftReport: { id: 1, catEntries: [] } },
}));

mock.module("../lib/api", () => ({
  api: { get, post },
}));

const { default: ShiftReportForm } = await import("./ShiftReportForm");

describe("ShiftReportForm", () => {
  beforeEach(() => {
    get.mockClear();
    post.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  test("submits shift-level fields for a new report", async () => {
    const onSuccess = mock(() => {});
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={onSuccess} />);

    await user.selectOptions(screen.getByLabelText("Shift Type"), "Evening");
    await user.type(screen.getByLabelText("Cleaning Notes"), "Swept floors");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      "/api/shift-reports",
      expect.objectContaining({
        shiftType: "Evening",
        cleaningNotes: "Swept floors",
        catEntries: [],
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(1));
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

    await user.click(screen.getByLabelText("Split shift (Morning/Evening only)"));
    expect(screen.getByLabelText("Which half of the shift?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    expect(await screen.findByText("Select First or Second shift")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  test("submits the chosen split-shift position", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(screen.getByLabelText("Split shift (Morning/Evening only)"));
    await user.selectOptions(screen.getByLabelText("Which half of the shift?"), "Second");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      "/api/shift-reports",
      expect.objectContaining({ isSplitShift: true, splitShiftPosition: "Second" }),
    );
  });

  test("individual entry has no Free-fed field, has a Most food-amount option", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByRole("combobox", { name: /add a cat/i }), [
      "cat:1",
    ]);

    expect(screen.queryByText("Free-fed")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: "Most" }).length).toBeGreaterThan(0);
  });

  test("group entry has no Water noted field", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByRole("combobox", { name: /add a cat/i }), [
      "group:10",
    ]);

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

  test("play group entry collapses via its Collapse button once it's valid", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Add Play Group" }));
    const section = document.getElementById("section-playGroups")!;
    const trigger = within(section).getByRole("button", { name: "New entry" });

    // Note is still empty: validation fails, so the entry stays open.
    await user.click(within(section).getByRole("button", { name: "Collapse" }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.type(within(section).getByLabelText("Note"), "Played nicely");
    await user.click(within(section).getByRole("button", { name: "Collapse" }));

    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
  });

  test("play group cats are picked by search and shown as removable chips", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Add Play Group" }));
    const section = document.getElementById("section-playGroups")!;

    await user.click(within(section).getByRole("button", { name: "Add cat" }));
    await user.type(await screen.findByPlaceholderText("Search cats…"), "pep");
    // Scoped to the popover's list: the add-entry <select> has cat <option>s too.
    const list = screen.getByRole("listbox");
    expect(within(list).queryByRole("option", { name: "Sprite" })).toBeNull();
    await user.click(within(list).getByRole("option", { name: "Pepsi" }));

    const remove = await within(section).findByRole("button", { name: "Remove Pepsi" });
    await user.click(remove);
    expect(within(section).queryByRole("button", { name: "Remove Pepsi" })).toBeNull();
  });

  test("has a Kennel Notes field after Kennel Status", () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(screen.getByLabelText("Kennel Notes")).toBeInTheDocument();
  });

  test("every kennel is listed, defaulted to its current state", async () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(await screen.findByLabelText("Kennel 5")).toHaveValue("Ready");
  });

  test("reporting a state that conflicts with the current one submits fine, no note needed", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByLabelText("Kennel 5"), "Occupied");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const payload = post.mock.calls[0]?.[1] as { kennelsStatus: unknown[] };
    expect(payload.kennelsStatus[0]).toMatchObject({ kennelId: 5, reportedState: "Occupied" });
  });

  test("confirming the current state submits as-is", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await screen.findByLabelText("Kennel 5");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const payload = post.mock.calls[0]?.[1] as { kennelsStatus: unknown[] };
    expect(payload.kennelsStatus).toHaveLength(1);
    expect(payload.kennelsStatus[0]).toMatchObject({ kennelId: 5, reportedState: "Ready" });
  });

  test("autosaves a draft when the page is hidden, and not again until something changes", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Shift Type"), "Evening");

    const hide = () => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    hide();

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      "/api/shift-reports",
      expect.objectContaining({ shiftType: "Evening", status: "Draft" }),
    );

    hide();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(post).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});
