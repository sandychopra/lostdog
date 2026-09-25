import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const post = mock(async () => ({ data: { user: {} } }));
const put = mock(async () => ({ data: { user: {} } }));

mock.module("../lib/api", () => ({
  api: { post, put },
}));

const { default: UserForm } = await import("./UserForm");

describe("UserForm", () => {
  beforeEach(() => {
    post.mockClear();
    put.mockClear();
  });

  afterEach(() => {
    mock.restore();
  });

  test("shows a validation error for a too-short name", async () => {
    const user = userEvent.setup();
    renderWithQuery(<UserForm onSuccess={() => {}} />);

    await user.type(screen.getByLabelText("Name"), "Al");
    await user.type(screen.getByLabelText("Email"), "al@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  test("submits a create request with the selected role", async () => {
    const onSuccess = mock(() => {});
    const user = userEvent.setup();
    renderWithQuery(<UserForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Name"), "New Volunteer");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.selectOptions(screen.getByLabelText("Role"), "Admin");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(
      "/api/users",
      expect.objectContaining({
        name: "New Volunteer",
        email: "new@example.com",
        password: "password123",
        role: "Admin",
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  test("edit mode allows a blank password and submits to the update endpoint", async () => {
    const onSuccess = mock(() => {});
    const user = userEvent.setup();
    renderWithQuery(
      <UserForm
        user={{ id: "1", name: "Existing User", email: "existing@example.com", role: "Volunteer" }}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith(
      "/api/users/1",
      expect.objectContaining({
        name: "Existing User",
        email: "existing@example.com",
        password: "",
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
