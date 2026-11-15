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

const { default: Navbar } = await import("./Navbar");

describe("Navbar", () => {
  test("shows Users only to Admins", () => {
    role = "Volunteer";
    const { unmount } = renderWithQuery(<Navbar />);
    expect(screen.getByRole("link", { name: "Announcements" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    unmount();

    role = "Admin";
    renderWithQuery(<Navbar />);
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
  });

  test("the phone menu opens a sheet of links and closes when one is tapped", async () => {
    role = "Volunteer";
    const user = userEvent.setup();
    renderWithQuery(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const sheet = within(await screen.findByRole("dialog"));
    expect(sheet.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    await user.click(sheet.getByRole("link", { name: "Cats" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
