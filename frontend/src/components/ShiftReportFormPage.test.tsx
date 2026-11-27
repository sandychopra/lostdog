import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";

mock.module("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "author", name: "Vera", role: "Volunteer" } } }),
    signOut: mock(async () => {}),
  },
}));

const draft = {
  id: 7,
  date: "2026-11-25T00:00:00.000Z",
  shiftType: "Morning",
  status: "Draft",
  authorId: "author",
  author: { id: "author", name: "Vera" },
};
const get = mock(async (url: string) => {
  if (url === "/api/shift-reports/my-draft") return { data: { shiftReport: draft } };
  throw new Error(`Unexpected GET ${url}`);
});
const post = mock(async () => ({ data: {} }));
mock.module("../lib/api", () => ({ api: { get, post, put: post, delete: post } }));

const { default: ShiftReportFormPage } = await import("./ShiftReportFormPage");

describe("ShiftReportFormPage", () => {
  test("starting a new report with a draft open shows a message instead of a form", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/shift-reports/new"]}>
          <Routes>
            <Route path="/shift-reports/new" element={<ShiftReportFormPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("You already have a draft in progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open draft" })).toHaveAttribute(
      "href",
      "/shift-reports/7/edit",
    );
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Report" })).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });
});
