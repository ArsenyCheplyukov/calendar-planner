import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.ts"],
    environment: "node",
    env: {
      // Pin TZ so tests that compare local-time components are deterministic
      TZ: "UTC",
    },
  },
});
