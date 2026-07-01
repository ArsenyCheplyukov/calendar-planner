import { describe, it, expect, vi } from "vitest";
import { buildAuthUrl, exchangeCodeForTokens } from "./oauth.js";

describe("buildAuthUrl", () => {
  it("returns a Google OAuth URL with the required params", () => {
    const url = buildAuthUrl({
      clientId: "test-client-id",
      redirectUri: "http://localhost:3001/auth/callback",
      scopes: [
        "https://www.googleapis.com/auth/calendar.freebusy",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/auth/callback",
    );
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
  });

  it("includes both scopes joined by a space", () => {
    const url = buildAuthUrl({
      clientId: "cid",
      redirectUri: "http://localhost:3001/auth/callback",
      scopes: [
        "https://www.googleapis.com/auth/calendar.freebusy",
        "https://www.googleapis.com/auth/calendar.events",
      ],
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
    );
  });
});

describe("exchangeCodeForTokens", () => {
  it("POSTs the code to Google and returns the parsed tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "ya29.abc",
          refresh_token: "1//0g_xyz",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "scope-a scope-b",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const tokens = await exchangeCodeForTokens(
      {
        code: "auth-code-123",
        clientId: "cid",
        clientSecret: "csecret",
        redirectUri: "http://localhost:3001/auth/callback",
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(tokens.access_token).toBe("ya29.abc");
    expect(tokens.refresh_token).toBe("1//0g_xyz");
    expect(tokens.expires_in).toBe(3600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = init.body as URLSearchParams;
    expect(body.get("code")).toBe("auth-code-123");
    expect(body.get("client_id")).toBe("cid");
    expect(body.get("client_secret")).toBe("csecret");
    expect(body.get("redirect_uri")).toBe("http://localhost:3001/auth/callback");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("throws a clear error when Google returns non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("invalid_grant", { status: 400 }),
    );

    await expect(
      exchangeCodeForTokens(
        {
          code: "bad",
          clientId: "cid",
          clientSecret: "csecret",
          redirectUri: "http://localhost:3001/auth/callback",
        },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/Token exchange failed: 400/);
  });
});
