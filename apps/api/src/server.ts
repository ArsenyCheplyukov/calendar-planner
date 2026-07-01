import { buildApp } from "./app.js";
import { loadEnvFromFile } from "./auth/cli.js";
import { resolve } from "node:path";

// Load .env from the repo root so DATABASE_URL, GEMINI_API_KEY, etc. are present
// at runtime. The auth CLI (npm run auth) does the same; the server needs it too.
loadEnvFromFile(resolve(import.meta.dirname, "../../../.env"));

const PORT = Number(process.env["API_PORT"] ?? 3001);
const HOST = process.env["API_HOST"] ?? "0.0.0.0";

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
