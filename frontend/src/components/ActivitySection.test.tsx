import { describe, expect, mock, test } from "bun:test";
import { screen } from "@testing-library/react";
import { renderWithQuery } from "../test/render";

const get = mock(async () => ({
  data: {
    activity: [
      {
        id: 1,
        action: "Update",
        description: "State changed from Ready to Occupied",
        createdAt: "2026-10-07T12:00:00.000Z",
        actor: { id: "a", name: "Admin Alice" },
      },
    ],
  },
}));

let role = "Admin";

mock.module("../lib/api", () => ({ api: { get } }));
mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u", name: "Me", role } }, isPending: false }),
    signOut: mock(async () => {}),
  },
}));

const { default: ActivitySection } = await import("./ActivitySection");

describe("ActivitySection", () => {
  test("shows the audit trail to an Admin", async () => {
    role = "Admin";
    renderWithQuery(<ActivitySection entityType="Kennel" entityId={3} />);

    expect(await screen.findByText(/State changed from Ready to Occupied/)).toBeInTheDocument();
    expect(screen.getByText("Admin Alice")).toBeInTheDocument();
  });

  test("renders nothing and makes no request for a Volunteer", () => {
    role = "Volunteer";
    get.mockClear();
    const { container } = renderWithQuery(<ActivitySection entityType="Kennel" entityId={3} />);

    expect(container).toBeEmptyDOMElement();
    expect(get).not.toHaveBeenCalled();
  });
});
