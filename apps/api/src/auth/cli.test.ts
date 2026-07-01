import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeRefreshTokenToEnv } from "./cli.js";

describe("writeRefreshTokenToEnv", () => {
  let tmpDir: string;
  let envPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "cli-test-"));
    envPath = join(tmpDir, ".env");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a new .env with GOOGLE_REFRESH_TOKEN when file does not exist", async () => {
    await writeRefreshTokenToEnv("1//fresh-token", envPath);

    const content = readFileSync(envPath, "utf8");
    expect(content).toMatch(/^GOOGLE_REFRESH_TOKEN=1\/\/fresh-token$/m);
  });

  it("preserves other keys and updates GOOGLE_REFRESH_TOKEN in an existing .env", async () => {
    writeFileSync(
      envPath,
      [
        "GOOGLE_CLIENT_ID=cid-123",
        "GOOGLE_CLIENT_SECRET=csecret-456",
        "GOOGLE_REFRESH_TOKEN=old-token",
        "GEMINI_API_KEY=gem-789",
      ].join("\n") + "\n",
    );

    await writeRefreshTokenToEnv("1//new-token", envPath);

    const content = readFileSync(envPath, "utf8");
    expect(content).toMatch(/^GOOGLE_CLIENT_ID=cid-123$/m);
    expect(content).toMatch(/^GOOGLE_CLIENT_SECRET=csecret-456$/m);
    expect(content).toMatch(/^GOOGLE_REFRESH_TOKEN=1\/\/new-token$/m);
    expect(content).not.toMatch(/old-token/);
    expect(content).toMatch(/^GEMINI_API_KEY=gem-789$/m);
  });

  it("appends GOOGLE_REFRESH_TOKEN when it is missing from existing .env", async () => {
    writeFileSync(
      envPath,
      ["GOOGLE_CLIENT_ID=cid", "GEMINI_API_KEY=gem"].join("\n") + "\n",
    );

    await writeRefreshTokenToEnv("1//added", envPath);

    const content = readFileSync(envPath, "utf8");
    expect(content).toMatch(/^GOOGLE_CLIENT_ID=cid$/m);
    expect(content).toMatch(/^GEMINI_API_KEY=gem$/m);
    expect(content).toMatch(/^GOOGLE_REFRESH_TOKEN=1\/\/added$/m);
  });
});
