import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

const API_DIR = resolve(import.meta.dirname, "../..");

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address !== "string") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not get ephemeral port"));
      }
    });
  });
}

function runAuthScript(
  port: number,
  opts: { tokenOverride?: string } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "node",
      ["--env-file=../../.env", "--import", "tsx", "src/auth/runAuth.ts"],
      {
        cwd: API_DIR,
        env: {
          ...process.env,
          GOOGLE_CLIENT_ID: "test-client-id",
          GOOGLE_CLIENT_SECRET: "test-client-secret",
          GOOGLE_REDIRECT_URI: `http://localhost:${port}/auth/callback`,
          ...(opts.tokenOverride !== undefined && { GOOGLE_REFRESH_TOKEN: opts.tokenOverride }),
        },
        detached: true,
      },
    );

    let stdout = "";
    let stderr = "";
    let resolved = false;

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const cleanup = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (resolved) return;
      resolved = true;
      resolve({ stdout, stderr, exitCode, signal });
    };

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      reject(err);
    });

    child.on("exit", (exitCode, signal) => {
      cleanup(exitCode, signal);
    });

    // Give the script enough time to print the auth prompt and start the
    // callback server, then terminate it so the test does not block forever.
    setTimeout(() => {
      if (resolved) return;
      child.kill("SIGTERM");
    }, 3000);
  });
}

describe("runAuth entry point", () => {
  it("starts the OAuth flow and listens for the callback when no refresh token exists", async () => {
    const port = await getFreePort();
    const { stdout, stderr, exitCode, signal } = await runAuthScript(port, { tokenOverride: "" });

    expect(stdout).toContain("Opening browser to authorize…");
    expect(stdout).toContain("If the browser does not open, visit:");
    expect(stdout).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(stdout).toContain("Waiting for Google to redirect back…");

    // The script keeps the callback server open until Google redirects back,
    // so we terminate it before that happens.
    expect(signal).toBe("SIGTERM");
    expect(exitCode).toBeNull();
    expect(stderr).not.toContain("Missing required env var");
  });

  it("skips the OAuth flow when a refresh token is already present", async () => {
    const port = await getFreePort();
    const { stdout, stderr, exitCode, signal } = await runAuthScript(port, { tokenOverride: "1//fake-token" });

    expect(stdout).toContain("Refresh token already present in .env.");
    expect(stdout).toContain("Run `pnpm auth --force` if you want to re-authenticate.");
    expect(stdout).not.toContain("Opening browser to authorize…");

    // The script exits cleanly without starting the callback server.
    expect(exitCode).toBe(0);
    expect(signal).toBeNull();
    expect(stderr).not.toContain("Missing required env var");
  });
});
