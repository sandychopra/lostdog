import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/bundler-plugins/vite";

// Brand colors per docs/project-scope.md's Design/Branding section. Icons in public/ are
// generated from public/logo.png by `bun run generate-pwa-assets` (see pwa-assets.config.ts).
export default defineConfig(({ mode }) => {
  // Loaded with no prefix filter so non-PUBLIC_ vars (like TUNNEL_HOST) are readable here;
  // they still never reach the browser bundle, which only gets envPrefix vars.
  const env = loadEnv(mode, import.meta.dirname, "");
  // Source maps are built and uploaded to Sentry only when SENTRY_AUTH_TOKEN is set (never
  // commit it), then deleted from dist/ so they never ship.
  const uploadSourceMaps = Boolean(env.SENTRY_AUTH_TOKEN);

  return {
    envPrefix: "PUBLIC_",
    build: {
      sourcemap: uploadSourceMaps ? "hidden" : false,
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      port: 3000,
      // Optional tunnel hostname (e.g. ngrok) for testing; Vite rejects requests for hosts not listed here.
      allowedHosts: env.TUNNEL_HOST ? [env.TUNNEL_HOST] : [],
      // Forwards the API through the frontend's port so a single tunnel (e.g. ngrok) serves both.
      // Only used when PUBLIC_API_URL is blank (same-origin); otherwise the app calls the backend directly.
      proxy: {
        "/api": "http://localhost:4000",
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Prompt rather than auto-reload, so an update can't wipe a half-filled shift report
        // (see ReloadPrompt.tsx, which also registers the service worker).
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "logo.png"],
        manifest: {
          name: "Lost Dog and Cat Rescue Foundation",
          short_name: "Lost Dog Rescue",
          theme_color: "#001F70",
          background_color: "#EEF1F6",
          display: "standalone",
          start_url: "/",
          icons: [
            { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Precache the self-hosted fonts too, so the installed app keeps its type offline.
          globPatterns: ["**/*.{js,css,html,woff2}"],
          // Never answer an /api navigation (e.g. a download link via the same-origin proxy)
          // with the cached app shell.
          navigateFallbackDenylist: [/^\/api\//],
          // The service worker is written after the Sentry plugin deletes .map files, so it
          // must not emit its own when build.sourcemap is on.
          sourcemap: false,
        },
      }),
      // Must stay last.
      sentryVitePlugin({
        org: "foglight-innovations",
        project: "lostdog-frontend",
        authToken: env.SENTRY_AUTH_TOKEN,
        disable: !uploadSourceMaps,
        release: env.PUBLIC_SENTRY_RELEASE ? { name: env.PUBLIC_SENTRY_RELEASE } : undefined,
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      }),
    ],
  };
});
