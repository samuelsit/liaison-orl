import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
      "server-only": path.resolve(root, "scripts/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    globalSetup: ["./tests/vitest.global-setup.ts"],
    setupFiles: ["./tests/vitest.setup.ts"],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: "forks",
  },
});
