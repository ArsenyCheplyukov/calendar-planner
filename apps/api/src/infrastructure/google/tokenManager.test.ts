import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenManager } from "./tokenManager.js";

const REFRESH_RESPONSE = {
  access_token: "ya29.initial",
  expires_in: 3600,
  token_type: "Bearer",
};

function buildFetchMock() {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(REFRESH_RESPONSE), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("TokenManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no refresh token is configured", async () => {
    const m = new TokenManager({
      refreshToken: "",
      clientId: "cid",
      clientSecret: "csecret",
    });
    expect(await m.getAccessToken()).toBeNull();
  });

  it("fetches a fresh access token on first call when refresh token is present", async () => {
    const fetchMock = buildFetchMock();
    const m = new TokenManager({
      refreshToken: "1//refresh",
      clientId: "cid",
      clientSecret: "csecret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const token = await m.getAccessToken();

    expect(token).toBe("ya29.initial");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("1//refresh");
    expect(body.get("client_id")).toBe("cid");
    expect(body.get("client_secret")).toBe("csecret");
  });

  it("caches the access token for subsequent calls within expiry", async () => {
    const fetchMock = buildFetchMock();
    const m = new TokenManager({
      refreshToken: "1//refresh",
      clientId: "cid",
      clientSecret: "csecret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await m.getAccessToken();
    await m.getAccessToken();
    await m.getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the access token after expiry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...REFRESH_RESPONSE, access_token: "ya29.first" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ...REFRESH_RESPONSE, access_token: "ya29.second" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const m = new TokenManager({
      refreshToken: "1//refresh",
      clientId: "cid",
      clientSecret: "csecret",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const first = await m.getAccessToken();
    expect(first).toBe("ya29.first");

    vi.advanceTimersByTime(3600 * 1000 + 1000);

    const second = await m.getAccessToken();
    expect(second).toBe("ya29.second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
