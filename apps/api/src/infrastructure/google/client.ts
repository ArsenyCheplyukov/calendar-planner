import { createRequire } from "node:module";
import type { calendar_v3 } from "googleapis";

export type GoogleCalendarClient = calendar_v3.Calendar;

/** Build an authenticated googleapis Calendar client from an access token. */
export function buildGoogleCalendarClient(accessToken: string): GoogleCalendarClient {
  // Lazy import: googleapis pulls a large tree; we only need the Calendar surface
  // for now, and lazy loading keeps `tsc --noEmit` fast and tests snappy.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { google } = createRequire(import.meta.url)("googleapis") as typeof import("googleapis");
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}
