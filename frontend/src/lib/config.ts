// Bun inlines process.env.PUBLIC_* at bundle time (bunfig.toml [serve.static] env, and --env on build).
export const API_BASE = process.env.PUBLIC_API_URL ?? "http://localhost:4000";
