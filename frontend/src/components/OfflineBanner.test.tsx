import { afterEach, describe, expect, test } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import OfflineBanner from "./OfflineBanner";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => setOnline(true));

describe("OfflineBanner", () => {
  test("appears while offline and disappears on reconnect", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();

    setOnline(false);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();

    setOnline(true);
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument();
  });
});
