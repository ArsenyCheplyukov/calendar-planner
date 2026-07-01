const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SAFETY_MARGIN_MS = 60_000; // refresh 1 minute before actual expiry

export interface TokenManagerConfig {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  clock?: () => number;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

export class TokenManager {
  private readonly refreshToken: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private cache: CachedToken | null = null;
  private inflight: Promise<string> | null = null;

  constructor(config: TokenManagerConfig) {
    this.refreshToken = config.refreshToken;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? Date.now;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.refreshToken) return null;

    if (this.cache && this.cache.expiresAt - SAFETY_MARGIN_MS > this.clock()) {
      return this.cache.accessToken;
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.refresh().finally(() => {
      this.inflight = null;
    });

    return this.inflight;
  }

  private async refresh(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await this.fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Token refresh failed: ${res.status} ${text}. Re-run \`npm run auth\`.`,
      );
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.cache = {
      accessToken: data.access_token,
      expiresAt: this.clock() + data.expires_in * 1000,
    };

    return this.cache.accessToken;
  }

  reset(): void {
    this.cache = null;
  }
}
