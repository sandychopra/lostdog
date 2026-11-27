import { describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

let role = "Volunteer";

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "1", name: "Vera Volunteer", role } } }),
    signOut: mock(async () => {}),
  },
}));
mock.module("../lib/api", () => ({
  api: { get: mock(async () => ({ data: { shiftReport: null } })) },
}));

const { default: BottomNav } = await import("./BottomNav");

describe("BottomNav", () => {
  test("has the main tabs and a New report button", () => {
    role = "Volunteer";
    renderWithQuery(<BottomNav />);
    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    expect(nav.getByRole("link", { name: "Updates" })).toHaveAttribute("href", "/notifications");
    expect(nav.getByRole("link", { name: "Cats" })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "New report" })).toHaveAttribute(
      "href",
      "/shift-reports/new",
    );
    expect(nav.getByRole("link", { name: "Reports" })).toHaveAttribute("href", "/shift-reports");
  });

  test("More opens a sheet with the other pages and closes when one is tapped", async () => {
    role = "Volunteer";
    const user = userEvent.setup();
    renderWithQuery(<BottomNav />);

    await user.click(screen.getByRole("button", { name: "More" }));
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(sheet.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();

    await user.click(sheet.getByRole("link", { name: "Kennels" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("More shows Users to Admins", async () => {
    role = "Admin";
    const user = userEvent.setup();
    renderWithQuery(<BottomNav />);
    await user.click(screen.getByRole("button", { name: "More" }));
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByRole("link", { name: "Users" })).toBeInTheDocument();
  });
});
