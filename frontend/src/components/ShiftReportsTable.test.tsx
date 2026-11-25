import { describe, expect, mock, test } from "bun:test";
import { useState } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery } from "../test/render";

const get = mock(async (_url: string, _config: { params: Record<string, unknown> }) => ({
  data: { shiftReports: [], total: 60 },
}));
mock.module("../lib/api", () => ({ api: { get } }));

const { default: ShiftReportsTable } = await import("./ShiftReportsTable");

function Paged() {
  const [page, setPage] = useState(1);
  return <ShiftReportsTable page={page} onPageChange={setPage} />;
}

describe("ShiftReportsTable pagination", () => {
  test("shows page X of Y and fetches the next page by offset", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Paged />);

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(get.mock.calls[0]?.[1].params).toMatchObject({ limit: 25, offset: 0 });

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    await waitFor(() =>
      expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({ limit: 25, offset: 25 }),
    );
  });
});
