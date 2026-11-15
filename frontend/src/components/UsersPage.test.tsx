import { describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const users = [
  {
    id: "1",
    name: "Vera Volunteer",
    email: "vera@example.com",
    role: "Volunteer",
    createdAt: new Date().toISOString(),
  },
];

const get = mock(async () => ({ data: { users } }));
const del = mock(async () => ({ data: { message: "User deleted" } }));

mock.module("../lib/api", () => ({
  api: { get, delete: del },
}));

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: "Admin", role: "Admin" } }, isPending: false }),
    signOut: mock(async () => {}),
  },
}));

const { default: UsersPage } = await import("./UsersPage");

describe("UsersPage", () => {
  test("opens the create dialog from the New User button", async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);

    await user.click(await screen.findByRole("button", { name: /New User/i }));

    expect(screen.getByRole("heading", { name: "Create User" })).toBeInTheDocument();
  });

  test("confirms and sends a delete request for the selected user", async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);

    await user.click(
      within(await screen.findByRole("table")).getByLabelText("Delete Vera Volunteer"),
    );
    expect(screen.getByText(/Are you sure you want to delete Vera Volunteer/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("/api/users/1"));
  });
});
