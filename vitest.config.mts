import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    // Disable the engine's stream pacing so integration tests run fast.
    env: { GAUNTLET_NO_DELAY: "1" },
  },
});
