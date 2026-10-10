import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Brand colors per docs/project-scope.md's Design/Branding section.
// Manifest icons are intentionally omitted until the org provides logo assets (see docs/project-scope.md).
export default defineConfig({
  envPrefix: "PUBLIC_",
  server: {
    port: 3000,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Lost Dog and Cat Rescue Foundation",
        short_name: "Lost Dog Rescue",
        theme_color: "#001F70",
        background_color: "#F6F5F4",
        icons: [],
      },
    }),
  ],
});
