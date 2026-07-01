import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(
  new URL("../../../..", import.meta.url),
);
export const ENV_PATH = resolve(REPO_ROOT, ".env");
