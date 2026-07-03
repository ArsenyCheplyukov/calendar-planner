import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRefreshTokenToEnv } from "./cli.js";

describe("writeRefreshTokenToEnv — empty-token regression", () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cli-empty-"));
    envPath = join(tmpDir, ".env");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces an existing empty GOOGLE_REFRESH_TOKEN= line with a real value", async () => {
    // This mirrors the state of the user's .env after copying from .env.example:
    // GOOGLE_REFRESH_TOKEN is present as a key but has no value.
    writeFileSync(
      envPath,
      [
        "GOOGLE_CLIENT_ID=cid-123",
        "GOOGLE_CLIENT_SECRET=csecret-456",
        "GOOGLE_REFRESH_TOKEN=",
        "GOOGLE_REDIRECT_URI=http://localhost:3001/auth/callback",
        "",
      ].join("\n"),
    );

    await writeRefreshTokenToEnv("1//fresh-refresh", envPath);

    const content = readFileSync(envPath, "utf8");
    expect(content).toMatch(/^GOOGLE_REFRESH_TOKEN=1\/\/fresh-refresh$/m);
    // No duplicate key, no leftover empty line.
    const matches = content.match(/^GOOGLE_REFRESH_TOKEN=/gm) ?? [];
    expect(matches.length).toBe(1);
    // Other keys preserved.
    expect(content).toMatch(/^GOOGLE_CLIENT_ID=cid-123$/m);
    expect(content).toMatch(/^GOOGLE_CLIENT_SECRET=csecret-456$/m);
    expect(content).toMatch(/^GOOGLE_REDIRECT_URI=http:\/\/localhost:3001\/auth\/callback$/m);
  });
});
