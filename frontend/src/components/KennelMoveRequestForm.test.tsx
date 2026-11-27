import { afterEach, describe, expect, mock, test } from "bun:test";
import { screen, within } from "@testing-library/react";
import { renderWithQuery } from "../test/render";
import type { Kennel } from "./KennelsTable";

function kennel(id: number, overrides: Partial<Kennel> = {}): Kennel {
  return { id, number: id, state: "Ready", deletedAt: null, cats: [], groups: [], ...overrides };
}

const source = kennel(1, {
  state: "Occupied",
  groups: [
    {
      id: 9,
      bonded: false,
      cats: [{ id: 1, name: "Kit" } as never, { id: 2, name: "Kat" } as never],
    },
  ],
});
const kennels = [
  source,
  kennel(2, { state: "Occupied", cats: [{ id: 3, name: "Pepsi" } as never] }),
  kennel(3, { state: "NeedsReset" }),
  kennel(4),
];

const get = mock(async () => ({ data: { kennels } }));

mock.module("../lib/api", () => ({
  api: { get, post: mock(async () => ({ data: {} })) },
}));

mock.module("../lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "2", role: "Admin" } } }) },
}));

const { default: KennelMoveRequestForm } = await import("./KennelMoveRequestForm");

describe("KennelMoveRequestForm", () => {
  afterEach(() => mock.restore());

  test("only offers empty kennels as destinations", async () => {
    renderWithQuery(<KennelMoveRequestForm kennel={source} onSuccess={() => {}} />);

    const select = screen.getByLabelText("Destination Kennel");
    await screen.findByRole("option", { name: /Kennel 3/ });
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);

    expect(options).toEqual(["Select a kennel", "Kennel 3 — NeedsReset", "Kennel 4 — Ready"]);
  });
});
