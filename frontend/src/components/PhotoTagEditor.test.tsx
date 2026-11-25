import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const put = mock(async (_url: string, payload: { catIds: number[] }) => ({
  data: {
    photo: {
      id: 7,
      tags: payload.catIds.map((catId) => ({ catId, cat: { id: catId, name: `Cat ${catId}` } })),
      uploadedBy: { id: "u", name: "U" },
    },
  },
}));

mock.module("../lib/api", () => ({ api: { put } }));

const { default: PhotoTagEditor } = await import("./PhotoTagEditor");

const cats = [
  { id: 1, name: "Pepsi" },
  { id: 2, name: "Sprite" },
];

describe("PhotoTagEditor", () => {
  beforeEach(() => put.mockClear());
  afterEach(() => mock.restore());

  test("saves tag changes on its own, with no Save Tags button", async () => {
    const onSaved = mock(() => {});
    const user = userEvent.setup();
    renderWithQuery(
      <PhotoTagEditor
        photoId={7}
        initialCatIds={[]}
        catOptions={cats}
        onSaved={onSaved}
        onDone={() => {}}
      />,
    );

    expect(screen.queryByRole("button", { name: "Save Tags" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add cat" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Pepsi" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith("/api/photos/7/tags", { catIds: [1] });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  test("Done saves a pending change right away", async () => {
    const onDone = mock(() => {});
    const user = userEvent.setup();
    renderWithQuery(
      <PhotoTagEditor photoId={7} initialCatIds={[]} catOptions={cats} onDone={onDone} />,
    );

    await user.click(screen.getByRole("button", { name: "Add cat" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Sprite" }));
    await user.keyboard("{Escape}"); // close the cat list
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalled();
    await waitFor(() => expect(put).toHaveBeenCalledWith("/api/photos/7/tags", { catIds: [2] }));
  });
});
