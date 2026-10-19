import { beforeEach, describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const signInEmail = mock(
  async (_values: unknown): Promise<{ error: { message?: string } | null }> => ({ error: null }),
);

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signIn: { email: signInEmail },
  },
}));

const { default: LoginPage } = await import("./LoginPage");

async function submit() {
  const user = userEvent.setup();
  renderWithQuery(<LoginPage />);
  await user.type(screen.getByLabelText("Email"), "vera@example.com");
  await user.type(screen.getByLabelText("Password"), "secret");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    signInEmail.mockReset();
  });

  test("shows the server's error for bad credentials", async () => {
    signInEmail.mockImplementation(async () => ({
      error: { message: "Invalid email or password" },
    }));
    await submit();

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  test("shows a connection error when the server can't be reached", async () => {
    signInEmail.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    await submit();

    expect(
      await screen.findByText("Can't reach the server — please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
