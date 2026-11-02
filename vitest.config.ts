import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  test: {
    // Integration specs talk to a real PostgreSQL database, so files run in
    // separate processes to keep module state (and the Prisma pool) isolated.
    isolate: true,
    globals: false,
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/server/**"],
      exclude: ["src/generated/**"],
    },
    projects: [
      {
        // Pure logic: no database, no network.
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        // Real PostgreSQL. Requires TEST_DATABASE_URL to point at a test
        // database.
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          // Specs truncate every table between runs, and TRUNCATE takes an
          // ACCESS EXCLUSIVE lock. Running files concurrently would deadlock
          // against a sibling spec's truncate, so they run one at a time.
          fileParallelism: false,
          sequence: { concurrent: false },
          // Prisma + argon2 are native; keep them external to Vite's transform.
          server: { deps: { external: [/@prisma/, /argon2/] } },
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        // Component rendering in jsdom.
        resolve: { alias },
        test: {
          name: "component",
          environment: "jsdom",
          globals: true,
          setupFiles: ["tests/setup/component.ts"],
          include: ["tests/component/**/*.test.tsx"],
        },
      },
    ],
  },
});
