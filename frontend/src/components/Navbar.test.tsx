import { describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../test/render";

let role = "Volunteer";
let draft: { id: number } | null = null;

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "1", name: "Vera Volunteer", role } } }),
    signOut: mock(async () => {}),
  },
}));
mock.module("../lib/api", () => ({
  api: { get: mock(async () => ({ data: { shiftReport: draft } })) },
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

  test("Start report opens a new report when there's no draft", async () => {
    role = "Volunteer";
    draft = null;
    renderWithQuery(<Navbar />);
    expect(await screen.findByRole("link", { name: "Start report" })).toHaveAttribute(
      "href",
      "/shift-reports/new",
    );
  });

  test("Start report resumes the user's draft", async () => {
    role = "Volunteer";
    draft = { id: 42 };
    renderWithQuery(<Navbar />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Start report" })).toHaveAttribute(
        "href",
        "/shift-reports/42/edit",
      ),
    );
  });
});
