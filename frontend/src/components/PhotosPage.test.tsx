import { beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const photos = [
  {
    id: 7,
    uploadedAt: "2026-10-07T12:00:00.000Z",
    catEntryId: null,
    tags: [],
    uploadedBy: { id: "u-other", name: "Other Volunteer" },
    shiftReport: { id: 3, date: "2026-10-07T00:00:00.000Z", shiftType: "Morning" },
  },
];

const get = mock(async (url: string) => {
  if (url === "/api/photos") return { data: { photos } };
  if (url === "/api/cats") return { data: { cats: [{ id: 1, name: "Whiskers", active: true }] } };
  if (url.endsWith("/url")) return { data: { url: null } };
  return { data: new Blob(["x"]), headers: {} };
});

let role = "Admin";

mock.module("../lib/api", () => ({ api: { get, put: mock(async () => ({ data: {} })) } }));
mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u-me", name: "Me", role } }, isPending: false }),
    signOut: mock(async () => {}),
  },
}));

const { default: PhotosPage } = await import("./PhotosPage");

describe("PhotosPage", () => {
  beforeEach(() => get.mockClear());

  test("lets an Admin download, edit tags, and delete", async () => {
    role = "Admin";
    renderWithQuery(<PhotosPage />);

    expect(await screen.findByLabelText("Download original")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit tags")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete photo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download all/ })).toBeInTheDocument();
  });

  test("hides downloads and editing/deleting others' photos from a Volunteer", async () => {
    role = "Volunteer";
    renderWithQuery(<PhotosPage />);

    expect(await screen.findByText("Unassigned")).toBeInTheDocument();
    expect(screen.queryByLabelText("Download original")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit tags")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete photo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download all/ })).not.toBeInTheDocument();
  });

  test("sends the unassigned filter to the API", async () => {
    role = "Admin";
    const user = userEvent.setup();
    renderWithQuery(<PhotosPage />);

    await user.click(await screen.findByLabelText("Unassigned only"));

    await waitFor(() =>
      expect(get).toHaveBeenCalledWith("/api/photos", {
        params: { unassigned: true, limit: 48 },
      }),
    );
  });
});
