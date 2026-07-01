import { describe, it, expect } from "vitest";
import { ENV_PATH } from "./envPath.js";

describe("ENV_PATH", () => {
  it("resolves to the repository-root .env file", () => {
    expect(ENV_PATH).toMatch(/calendar_planner[/\\]\.env$/);
  });
});
