// Vite inlines import.meta.env.PUBLIC_* at build time (see envPrefix in vite.config.ts).
export const API_BASE = import.meta.env.PUBLIC_API_URL ?? "http://localhost:4000";
