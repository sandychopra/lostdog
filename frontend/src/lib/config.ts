// Vite inlines import.meta.env.PUBLIC_* at build time (see envPrefix in vite.config.ts).
// Blank means same-origin: in production the backend serves the frontend itself (the Dockerfile
// builds with it blank); in dev, requests go through the Vite dev server's /api proxy (tunnels).
const configured = import.meta.env.PUBLIC_API_URL;
export const API_BASE =
  configured === "" ? window.location.origin : (configured ?? "http://localhost:4000");
