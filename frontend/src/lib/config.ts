// Vite inlines import.meta.env.PUBLIC_* at build time (see envPrefix in vite.config.ts).
// Blank means same-origin: requests go through the Vite dev server's /api proxy (used for tunnels).
const configured = import.meta.env.PUBLIC_API_URL;
export const API_BASE =
  configured === "" ? window.location.origin : (configured ?? "http://localhost:4000");
