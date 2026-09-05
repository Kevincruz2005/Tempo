import { writeFile } from "node:fs/promises";

const configured = process.env.TEMPO_API_BASE?.trim();
if (!configured) throw new Error("TEMPO_API_BASE must be set for the Vercel build");

let api;
try {
  api = new URL(configured);
} catch {
  throw new Error("TEMPO_API_BASE must be an absolute URL");
}
if (api.protocol !== "https:") throw new Error("TEMPO_API_BASE must use HTTPS");

await writeFile(
  "packages/web/public/runtime-config.js",
  `window.TEMPO_RUNTIME_CONFIG = Object.freeze({ apiBase: ${JSON.stringify(api.origin)} });\n`,
  "utf8",
);
