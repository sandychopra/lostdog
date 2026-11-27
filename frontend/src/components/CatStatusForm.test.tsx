import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";
import type { Cat } from "./CatsTable";

const patch = mock(async () => ({ data: { cat: {} } }));

mock.module("../lib/api", () => ({
  api: { patch },
}));

const { default: CatStatusForm } = await import("./CatStatusForm");

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 7,
    name: "Pepsi",
    ageYears: null,
    ageMonths: 4,
    sex: "Female",
    colorPattern: "Gray & White",
    collarColor: null,
    microchipNumber: null,
    kennelId: null,
    groupId: 3,
    litterId: null,
    status: "Available",
    active: true,
    dewormerStatus: "NotNeeded",
    dewormerDueDate: null,
    needsProbiotic: false,
    pickupAt: null,
    kennel: null,
    group: { id: 3, bonded: false, kennel: { id: 2, number: 2 } },
    litter: null,
    ...overrides,
  };
}

describe("CatStatusForm", () => {
  beforeEach(() => patch.mockClear());
  afterEach(() => mock.restore());

  test("combines the separate pickup date and time into pickupAt", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CatStatusForm cat={makeCat()} onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("New Status"), "Adopted");
    await user.type(screen.getByLabelText("Pickup Date"), "2026-12-05");
    await user.type(screen.getByLabelText("Time (optional)"), "14:30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [url, payload] = patch.mock.calls[0] as unknown as [
      string,
      { status: string; pickupAt: Date },
    ];
    expect(url).toBe("/api/cats/7/status");
    expect(payload.status).toBe("Adopted");
    expect(payload.pickupAt).toEqual(new Date("2026-12-05T14:30"));
  });

  test("assumes noon when only a date is chosen", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CatStatusForm cat={makeCat()} onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("New Status"), "PendingAdoption");
    await user.type(screen.getByLabelText("Pickup Date"), "2026-12-05");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, payload] = patch.mock.calls[0] as unknown as [string, { pickupAt: Date }];
    expect(payload.pickupAt).toEqual(new Date("2026-12-05T12:00"));
  });

  test("clearing the pickup date on an adopted cat sends pickupAt: null", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <CatStatusForm
        cat={makeCat({ status: "Adopted", pickupAt: "2026-12-05T17:00:00.000Z" })}
        onSuccess={() => {}}
      />,
    );

    await user.clear(screen.getByLabelText("Time (optional)"));
    await user.clear(screen.getByLabelText("Pickup Date"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [, payload] = patch.mock.calls[0] as unknown as [
      string,
      { status: string; pickupAt: Date | null },
    ];
    expect(payload).toEqual({ status: "Adopted", pickupAt: null });
  });

  test("a time without a date is rejected", async () => {
    const user = userEvent.setup();
    renderWithQuery(<CatStatusForm cat={makeCat()} onSuccess={() => {}} />);

    await user.selectOptions(screen.getByLabelText("New Status"), "Adopted");
    await user.type(screen.getByLabelText("Time (optional)"), "14:30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Choose a pickup date for this time")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });
});
