import { describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
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
];

const get = mock(async () => ({ data: { users } }));

mock.module("../lib/api", () => ({
  api: { get },
}));

const { default: UsersTable } = await import("./UsersTable");

describe("UsersTable", () => {
  test("lists users and hides the delete action for Admin rows", async () => {
    renderWithQuery(<UsersTable onEdit={() => {}} onDelete={() => {}} />);

    expect(await screen.findByText("Vera Volunteer")).toBeInTheDocument();
    expect(screen.getByText("Ann Admin")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText("Delete Vera Volunteer")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Delete Ann Admin")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Edit Ann Admin")).toBeInTheDocument();
  });
});
