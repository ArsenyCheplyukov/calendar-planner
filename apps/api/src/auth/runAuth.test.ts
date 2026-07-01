import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const API_DIR = resolve(import.meta.dirname, "../..");

function runAuthScript(): Promise<{ stdout: string; stderr: string; exitCode: number | null; signal: NodeJS.Signals | null }> {
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
          GOOGLE_REDIRECT_URI: "http://localhost:3001/auth/callback",
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
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }, 3000);
  });
}

describe("runAuth entry point", () => {
  it("starts the OAuth flow and listens for the callback", async () => {
    const { stdout, stderr, exitCode, signal } = await runAuthScript();

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
});
