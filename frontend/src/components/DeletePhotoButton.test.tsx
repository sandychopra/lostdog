import { beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

let failDelete = false;
const del = mock(async (_url: string) => {
  if (failDelete) throw new Error("boom");
  return { data: { message: "Photo deleted" } };
});

mock.module("../lib/api", () => ({ api: { delete: del } }));

const { default: DeletePhotoButton } = await import("./DeletePhotoButton");

describe("DeletePhotoButton", () => {
  beforeEach(() => {
    del.mockClear();
    failDelete = false;
  });

  test("asks for confirmation, then deletes and reports back", async () => {
    const user = userEvent.setup();
    const onDeleted = mock(() => {});
    renderWithQuery(<DeletePhotoButton photoId={7} onDeleted={onDeleted} />);

    await user.click(screen.getByLabelText("Delete photo"));
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledWith("/api/photos/7");
    await waitFor(() => expect(screen.queryByText(/cannot be undone/)).not.toBeInTheDocument());
  });

  test("cancel leaves the photo alone", async () => {
    const user = userEvent.setup();
    renderWithQuery(<DeletePhotoButton photoId={7} />);

    await user.click(screen.getByLabelText("Delete photo"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(del).not.toHaveBeenCalled();
  });

  test("keeps the dialog open with an error when the delete fails", async () => {
    failDelete = true;
    const user = userEvent.setup();
    const onDeleted = mock(() => {});
    renderWithQuery(<DeletePhotoButton photoId={7} onDeleted={onDeleted} />);

    await user.click(screen.getByLabelText("Delete photo"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Failed to delete photo")).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
