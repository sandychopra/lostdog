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
let myDraft: { id: number } | null = null;
mock.module("../lib/api", () => ({
  api: { get: mock(async () => ({ data: { shiftReport: myDraft } })) },
}));

const { default: Navbar } = await import("./Navbar");

describe("Navbar", () => {
  test("shows Users only to Admins", () => {
    role = "Volunteer";
    const { unmount } = renderWithQuery(<Navbar />);
    expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    unmount();

    role = "Admin";
    renderWithQuery(<Navbar />);
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
  });

  test("New Report opens a new report when there's no open draft", async () => {
    role = "Volunteer";
    myDraft = null;
    renderWithQuery(<Navbar />);
    expect(await screen.findByRole("link", { name: "New Report" })).toHaveAttribute(
      "href",
      "/shift-reports/new",
    );
  });

  test("with an open draft it reads Edit Draft and opens that draft", async () => {
    role = "Volunteer";
    myDraft = { id: 42 };
    renderWithQuery(<Navbar />);
    expect(await screen.findByRole("link", { name: "Edit Draft" })).toHaveAttribute(
      "href",
      "/shift-reports/42/edit",
    );
    myDraft = null;
  });
});
