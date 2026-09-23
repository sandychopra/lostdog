import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// @ts-expect-error jest-dom's types are ambient-only (no exports), which dynamic import() can't type
await import("@testing-library/jest-dom");
const { afterEach } = await import("bun:test");
const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});
