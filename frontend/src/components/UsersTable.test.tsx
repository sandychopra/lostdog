import { describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithQuery } from "../test/render";

const users = [
  {
    id: "1",
    name: "Vera Volunteer",
    email: "vera@example.com",
    role: "Volunteer",
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Ann Admin",
    email: "ann@example.com",
    role: "Admin",
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Otto Otheradmin",
    email: "otto@example.com",
    role: "Admin",
    createdAt: new Date().toISOString(),
  },
];

const get = mock(async () => ({ data: { users } }));

mock.module("../lib/api", () => ({
  api: { get },
}));

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "2", name: "Ann Admin", role: "Admin" } } }),
  },
}));

const { default: UsersTable } = await import("./UsersTable");

describe("UsersTable", () => {
  test("lists users, allows deleting other Admins, and hides delete on your own row", async () => {
    renderWithQuery(<UsersTable onEdit={() => {}} onDelete={() => {}} />);

    // Phone cards and the desktop table both render (CSS picks one); check the table.
    const table = within(await screen.findByRole("table"));
    expect(await table.findByText("Vera Volunteer")).toBeInTheDocument();
    expect(table.getByText("Ann Admin")).toBeInTheDocument();

    await waitFor(() => {
      expect(table.getByLabelText("Delete Vera Volunteer")).toBeInTheDocument();
    });
    expect(table.getByLabelText("Delete Otto Otheradmin")).toBeInTheDocument();
    expect(table.queryByLabelText("Delete Ann Admin")).not.toBeInTheDocument();
    expect(table.getByLabelText("Edit Ann Admin")).toBeInTheDocument();
  });

  test("renders the same per-user actions on the phone cards", async () => {
    renderWithQuery(<UsersTable onEdit={() => {}} onDelete={() => {}} />);

    await screen.findAllByText("Vera Volunteer");
    expect(screen.getAllByLabelText("Delete Vera Volunteer")).toHaveLength(2);
    expect(screen.queryAllByLabelText("Delete Ann Admin")).toHaveLength(0);
  });
});
