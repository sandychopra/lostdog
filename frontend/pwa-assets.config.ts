import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Source is the org's site icon from lostdogrescue.org (already has its own margin).
// To swap in an official logo, replace public/logo.png and run `bun run generate-pwa-assets`.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    // Maskable icons get cropped to a circle/squircle, so keep the badge inside the safe zone.
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0.2,
      resizeOptions: { background: "#FFFFFF" },
    },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: "#FFFFFF" } },
  },
  images: ["public/logo.png"],
});
