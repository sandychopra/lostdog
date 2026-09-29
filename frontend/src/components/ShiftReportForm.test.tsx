import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
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
            lastProbioticGivenAt: null,
          },
        ],
      },
    };
  }
  if (url === "/api/kennels") {
    return {
      data: {
        kennels: [{ id: 5, number: 5, state: "Ready", cats: [], groups: [] }],
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

    await user.click(screen.getByRole("button", { name: "Add Individual Entry" }));

    expect(screen.queryByText("Free-fed")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Most" }).length).toBeGreaterThan(0);
  });

  test("group entry has no Water noted field", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Add Group Entry" }));

    expect(screen.queryByText("Water noted (shared)")).not.toBeInTheDocument();
  });

  test("has a Kennel Notes field after Kennel Status", () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(screen.getByLabelText("Kennel Notes")).toBeInTheDocument();
  });

  test("every kennel is listed, defaulted to its current state", async () => {
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    expect(await screen.findByLabelText("Kennel 5")).toHaveValue("Ready");
  });

  test("reporting a state that conflicts with the current one requires a note", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await user.selectOptions(await screen.findByLabelText("Kennel 5"), "Occupied");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    expect(await screen.findByText(/a note is required/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  test("confirming the current state needs no note", async () => {
    const user = userEvent.setup();
    renderWithQuery(<ShiftReportForm onSuccess={() => {}} />);

    await screen.findByLabelText("Kennel 5");
    await user.click(screen.getByRole("button", { name: "Submit Report" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const payload = post.mock.calls[0]?.[1] as { kennelsStatus: unknown[] };
    expect(payload.kennelsStatus).toHaveLength(1);
    expect(payload.kennelsStatus[0]).toMatchObject({ kennelId: 5, reportedState: "Ready" });
  });
});
