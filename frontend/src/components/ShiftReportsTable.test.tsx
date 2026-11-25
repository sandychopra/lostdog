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
  const [pageSize, setPageSize] = useState(10);
  return (
    <ShiftReportsTable
      page={page}
      onPageChange={setPage}
      pageSize={pageSize}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
    />
  );
}

describe("ShiftReportsTable pagination", () => {
  test("shows page X of Y and fetches the next page by offset", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Paged />);

    expect(await screen.findByText("Page 1 of 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(get.mock.calls[0]?.[1].params).toMatchObject({ limit: 10, offset: 0 });

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 6")).toBeInTheDocument();
    await waitFor(() =>
      expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({ limit: 10, offset: 10 }),
    );
  });

  test("changing the page size goes back to page 1 with the new size", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Paged />);
    await screen.findByText("Page 1 of 6");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 6");

    await user.selectOptions(screen.getByLabelText("Reports per page"), "25");

    expect(await screen.findByText("Page 1 of 3")).toBeInTheDocument();
    await waitFor(() =>
      expect(get.mock.calls.at(-1)?.[1].params).toMatchObject({ limit: 25, offset: 0 }),
    );
  });
});
