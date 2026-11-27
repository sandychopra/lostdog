import { beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const now = new Date().toISOString();

function cat(id: number, name: string, active = true) {
  return {
    id,
    name,
    status: "Available",
    pickupAt: null,
    pickedUpAt: null,
    dewormerStatus: "NotNeeded",
    dewormerDueDate: null,
    needsProbiotic: false,
    collarColor: null,
    active,
    kennel: active ? { id: id, number: id } : null,
  };
}

function notification(id: number, type: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type,
    title: null,
    message: null,
    cat: null,
    kennel: null,
    checklist: null,
    signTasks: [],
    kennelMoveRequests: [],
    doses: [],
    lastProbioticGivenAt: null,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    dismissed: false,
    dismissNote: null,
    createdBy: null,
    comment: null,
    commentedAt: null,
    commentedBy: null,
    createdAt: now,
    ...overrides,
  };
}

const pepsi = cat(1, "Pepsi");
const biscuit = cat(2, "Biscuit");
const gone = cat(3, "Clementine", false);

const notifications = [
  notification(1, "NewArrival", { cat: pepsi }),
  notification(2, "ProbioticNeeded", { cat: biscuit }),
  notification(3, "KennelNeedsReset", { kennel: { id: 7, number: 7 } }),
  notification(4, "BackAvailable", {
    cat: biscuit,
    resolved: true,
    resolvedAt: now,
  }),
  notification(5, "Manual", {
    title: "Vet visit Friday",
    resolved: true,
    resolvedAt: now,
    dismissed: true,
  }),
  notification(6, "NewArrival", { cat: gone }),
  notification(7, "PickedUp", { cat: gone }),
];

const get = mock(async () => ({ data: { notifications } }));

mock.module("../lib/api", () => ({
  api: { get, patch: mock(async () => ({ data: {} })), post: mock(async () => ({ data: {} })) },
}));
mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "u1", name: "Vera", role: "Volunteer" } },
      isPending: false,
    }),
    signOut: mock(async () => {}),
  },
}));

const { default: NotificationsPage } = await import("./NotificationsPage");

// The notification cards (each has an h2 headline: cat name, kennel or post title).
function cards(): HTMLElement[] {
  return screen.queryAllByRole("listitem").filter((item) => item.querySelector("h2"));
}

function headlines(): string[] {
  return cards().map((item) => item.querySelector("h2")!.textContent ?? "");
}

function typeLabels(): string[] {
  return cards().map((item) => item.querySelector("p")!.textContent ?? "");
}

async function renderPage() {
  renderWithQuery(<NotificationsPage />);
  await screen.findByRole("button", { name: "Pepsi" });
}

describe("NotificationsPage filters", () => {
  beforeEach(() => get.mockClear());

  test("Open (default) hides done and not-relevant cards, and a departed cat's other cards", async () => {
    await renderPage();
    expect(headlines().sort()).toEqual(["Biscuit", "Clementine", "Kennel 7", "Pepsi"]);
    // Clementine left: only her Picked Up card stays.
    expect(typeLabels()).toContain("Picked Up");
    expect(typeLabels()).not.toContain("Back Available");
  });

  test("Status: Not relevant shows only dismissed cards", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.selectOptions(screen.getByLabelText("Status"), "notRelevant");
    await waitFor(() => expect(headlines()).toEqual(["Vet visit Friday"]));
  });

  test("Kind chips: Medical, Needs action, Informational", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("radio", { name: "Medical" }));
    expect(headlines()).toEqual(["Biscuit"]);
    expect(typeLabels()).toEqual(["Probiotic"]);

    await user.click(screen.getByRole("radio", { name: "Needs action" }));
    expect(headlines()).toEqual(["Kennel 7"]);

    await user.click(screen.getByRole("radio", { name: "Informational" }));
    expect(headlines().sort()).toEqual(["Clementine", "Pepsi"]);
  });

  test("tapping a cat's name filters to that cat, and × clears it", async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Pepsi" }));
    await waitFor(() => expect(headlines()).toEqual(["Pepsi"]));
    expect((screen.getByLabelText("Cat") as HTMLSelectElement).value).toBe("1");

    await user.click(screen.getByRole("button", { name: "Clear cat filter Pepsi" }));
    await waitFor(() => expect(headlines().length).toBeGreaterThan(1));
  });

  test("the Cat dropdown lists cats in view", async () => {
    const user = userEvent.setup();
    await renderPage();
    const options = within(screen.getByLabelText("Cat"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["All cats", "Biscuit", "Clementine", "Pepsi"]);

    await user.selectOptions(screen.getByLabelText("Cat"), "2");
    expect(headlines()).toEqual(["Biscuit"]);
  });
});
