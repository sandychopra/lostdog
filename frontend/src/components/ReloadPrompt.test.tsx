import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let needRefresh = true;
const setNeedRefresh = mock((value: boolean) => {
  needRefresh = value;
});
const updateServiceWorker = mock(async () => {});

mock.module("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, () => {}],
    updateServiceWorker,
  }),
}));

const { default: ReloadPrompt } = await import("./ReloadPrompt");

describe("ReloadPrompt", () => {
  test("renders nothing until a new version is waiting", () => {
    needRefresh = false;
    render(<ReloadPrompt />);
    expect(screen.queryByText(/new version/i)).not.toBeInTheDocument();
  });

  test("Reload activates the waiting service worker and reloads", async () => {
    needRefresh = true;
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  test("Later dismisses the prompt without updating", async () => {
    needRefresh = true;
    updateServiceWorker.mockClear();
    const user = userEvent.setup();
    render(<ReloadPrompt />);

    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
