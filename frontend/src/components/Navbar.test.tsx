import { describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "../test/render";

let role = "Volunteer";

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "1", name: "Vera Volunteer", role } } }),
    signOut: mock(async () => {}),
  },
}));
mock.module("../lib/api", () => ({
  api: { get: mock(async () => ({ data: {} })) },
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

  test("New report always opens a blank report", () => {
    role = "Volunteer";
    renderWithQuery(<Navbar />);
    expect(screen.getByRole("link", { name: "New report" })).toHaveAttribute(
      "href",
      "/shift-reports/new",
    );
  });
});
