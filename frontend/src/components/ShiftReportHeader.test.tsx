import { afterEach, describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";
import type { ShiftReport } from "./ShiftReportsTable";

let user = { id: "author", name: "Vera", role: "Volunteer" };
mock.module("../lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user } }) },
}));
mock.module("../lib/api", () => ({ api: { delete: mock(async () => ({})) } }));

const { default: ShiftReportHeader } = await import("./ShiftReportHeader");

const report = {
  id: 3,
  date: "2026-11-25T00:00:00.000Z",
  shiftType: "Morning",
  status: "Draft",
  isSplitShift: false,
  splitShiftPosition: null,
  authorId: "author",
  author: { id: "author", name: "Vera" },
} as unknown as ShiftReport;

async function openMenu() {
  await userEvent.setup().click(screen.getByRole("button", { name: "Report actions" }));
}

describe("ShiftReportHeader", () => {
  afterEach(() => {
    user = { id: "author", name: "Vera", role: "Volunteer" };
  });

  test("view page: the author gets Edit in the ⋮ menu, but not Delete", async () => {
    renderWithQuery(<ShiftReportHeader report={report} mode="view" />);
    expect(screen.getByRole("heading")).toHaveTextContent("Morning");
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  test("edit page: the menu offers View report, and Delete for an Admin", async () => {
    user = { id: "admin", name: "Ada", role: "Admin" };
    renderWithQuery(<ShiftReportHeader report={report} mode="edit" />);
    expect(screen.getByText(/Editing · By Vera/)).toBeInTheDocument();
    await openMenu();
    expect(await screen.findByRole("menuitem", { name: "View report" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
  });

  test("someone else's report: no menu for a non-admin on the view page", () => {
    user = { id: "other", name: "Otto", role: "Volunteer" };
    renderWithQuery(<ShiftReportHeader report={report} mode="view" />);
    expect(screen.queryByRole("button", { name: "Report actions" })).toBeNull();
  });
});
