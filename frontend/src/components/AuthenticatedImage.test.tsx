import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../test/render";

let signedUrl: string | null = null;
let signCount = 0;

const get = mock(async (url: string) => {
  if (url.endsWith("/url")) {
    signCount++;
    return { data: { url: signedUrl === null ? null : `${signedUrl}?sig=${signCount}` } };
  }
  return { data: new Blob(["x"], { type: "image/jpeg" }) };
});

mock.module("../lib/api", () => ({ api: { get } }));

const { default: AuthenticatedImage } = await import("./AuthenticatedImage");

describe("AuthenticatedImage", () => {
  beforeEach(() => {
    get.mockClear();
    signCount = 0;
  });

  test("loads a signed bucket URL directly, without fetching the file", async () => {
    signedUrl = "https://bucket.example.com/thumb.jpg";
    renderWithQuery(<AuthenticatedImage photoId={7} alt="Cat" />);

    const img = await screen.findByAltText("Cat");
    expect(img.getAttribute("src")).toBe("https://bucket.example.com/thumb.jpg?sig=1");
    expect(get).toHaveBeenCalledWith("/api/photos/7/url", { params: { size: "thumb" } });
    expect(get.mock.calls.some(([url]) => url.endsWith("/file"))).toBe(false);
  });

  test("re-signs once when the signed URL fails to load", async () => {
    signedUrl = "https://bucket.example.com/thumb.jpg";
    renderWithQuery(<AuthenticatedImage photoId={7} alt="Cat" />);

    fireEvent.error(await screen.findByAltText("Cat"));
    await waitFor(() => expect(screen.getByAltText("Cat").getAttribute("src")).toEndWith("?sig=2"));

    fireEvent.error(screen.getByAltText("Cat"));
    await new Promise((r) => setTimeout(r, 20));
    expect(signCount).toBe(2);
  });

  test("falls back to fetching the thumbnail through the API when storage can't sign", async () => {
    signedUrl = null;
    renderWithQuery(<AuthenticatedImage photoId={7} alt="Cat" />);

    const img = await screen.findByAltText("Cat");
    expect(img.getAttribute("src")).toStartWith("blob:");
    expect(get).toHaveBeenCalledWith("/api/photos/7/file", {
      params: { size: "thumb" },
      responseType: "blob",
    });
  });
});
