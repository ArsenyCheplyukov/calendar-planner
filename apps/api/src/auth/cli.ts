import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_ENV = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
] as const;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events",
];

export function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function loadEnvFromFile(envPath: string): void {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export async function writeRefreshTokenToEnv(
  refreshToken: string,
  envPath: string,
): Promise<void> {
  const path = resolve(envPath);
  let lines: string[] = [];

  if (existsSync(path)) {
    const content = readFileSync(path, "utf8");
    const filtered = content
      .split("\n")
      .filter((line) => !/^GOOGLE_REFRESH_TOKEN\s*=/.test(line));
    lines = filtered.filter((line, i, arr) => {
      if (line.trim() === "" && i === arr.length - 1) return false;
      return true;
    });
  }

  lines.push(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
  const trailing = lines[lines.length - 1]?.endsWith("\n") ? "" : "\n";
  writeFileSync(path, lines.join("\n") + trailing);
}

export { REQUIRED_ENV, SCOPES };
