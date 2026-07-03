import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings, type SettingsPrefs } from "./Settings.js";

const DEFAULTS: SettingsPrefs = {
  workingHoursStart: "09:00",
  workingHoursEnd: "19:00",
  bufferMinutes: 15,
  typeBiasFocus: "09:00-12:00",
  typeBiasMeeting: "11:00-16:00",
  typeBiasPersonal: "any",
  typeBiasErrand: "16:00-19:00",
  blackouts: [],
  timeZone: "UTC",
};

function makeFetchMock(prefs: SettingsPrefs) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/preferences") && (!init || init.method === "GET" || init.method === undefined)) {
      return Promise.resolve(new Response(JSON.stringify(prefs), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    if (url.includes("/api/preferences") && init?.method === "PUT") {
      const body = JSON.parse(init.body as string);
      return Promise.resolve(new Response(JSON.stringify({ ...prefs, ...body }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.reject(new Error("unexpected: " + url));
  });
}

describe("Settings page", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("loads and displays the current preferences", async () => {
    const stored: SettingsPrefs = { ...DEFAULTS, workingHoursStart: "08:00" };
    vi.stubGlobal("fetch", makeFetchMock(stored));
    render(<Settings />);

    await waitFor(() => {
      const input = screen.getByLabelText(/начало рабочего дня/i) as HTMLInputElement;
      expect(input.value).toBe("08:00");
    });
  });

  it("submits a partial update via PUT and shows a success toast", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", makeFetchMock(DEFAULTS));
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText(/начало рабочего дня/i)).toBeInTheDocument();
    });

    const startInput = screen.getByLabelText(/начало рабочего дня/i);
    await user.clear(startInput);
    await user.type(startInput, "08:00");

    await user.click(screen.getByRole("button", { name: /сохранить/i }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-toast")).toBeInTheDocument();
    });
  });

  it("shows an error message when the API rejects the update", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(new Response(JSON.stringify({ error: "bad_request", message: "Invalid time" }), { status: 400, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify(DEFAULTS), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByLabelText(/начало рабочего дня/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /сохранить/i }));

    expect(await screen.findByTestId("settings-error")).toBeInTheDocument();
  });
});
