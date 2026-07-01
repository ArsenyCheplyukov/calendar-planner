/* eslint-disable no-console */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  getRequiredEnv,
  loadEnvFromFile,
  SCOPES,
  writeRefreshTokenToEnv,
} from "./cli.js";
import { buildAuthUrl, exchangeCodeForTokens } from "../infrastructure/google/oauth.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../../..");
const ENV_PATH = resolve(REPO_ROOT, ".env");

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

function waitForAuthorizationCode(redirectUri: string): Promise<string> {
  const url = new URL(redirectUri);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const path = url.pathname;

  return new Promise((resolveCode, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url) {
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      const reqUrl = new URL(req.url, redirectUri);
      if (reqUrl.pathname !== path) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const error = reqUrl.searchParams.get("error");
      if (error) {
        res.writeHead(400);
        res.end(`Google returned an error: ${error}`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        res.end("Missing code");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<h1>Authorization complete</h1><p>You can close this tab and return to the terminal.</p>",
      );
      server.close();
      resolveCode(code);
    });

    server.listen(port, () => {
      // server is ready
    });

    server.on("error", reject);
  });
}

export async function runAuth(): Promise<void> {
  loadEnvFromFile(ENV_PATH);

  const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getRequiredEnv("GOOGLE_REDIRECT_URI");

  const authUrl = buildAuthUrl({
    clientId,
    redirectUri,
    scopes: SCOPES,
  });

  console.log("Opening browser to authorize…");
  console.log("If the browser does not open, visit:");
  console.log(authUrl);

  openBrowser(authUrl);

  console.log("Waiting for Google to redirect back…");
  const code = await waitForAuthorizationCode(redirectUri);

  console.log("Exchanging authorization code for tokens…");
  const tokens = await exchangeCodeForTokens({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token in response. Revoke the app's access at https://myaccount.google.com/permissions and try again.",
    );
  }

  await writeRefreshTokenToEnv(tokens.refresh_token, ENV_PATH);

  console.log("Refresh token written to .env. You can now run the app.");
}
