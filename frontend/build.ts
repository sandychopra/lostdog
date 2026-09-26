// Production build. Uses the JS API because `bun build` on the CLI doesn't load the
// [serve.static] plugins from bunfig.toml, so Tailwind would otherwise be skipped.
import tailwind from "bun-plugin-tailwind";

const result = await Bun.build({
  entrypoints: ["./src/index.html"],
  outdir: "./dist",
  plugins: [tailwind],
  env: "PUBLIC_*",
  minify: true,
  sourcemap: "linked",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const output of result.outputs) console.log(output.path);
