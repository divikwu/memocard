import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { alias: [
    { find: "../src/components/tag-navigation", replacement: process.env.MEMOCARD_TAG_BENCH_SOURCE || fileURLToPath(new URL("../src/components/tag-navigation.tsx", import.meta.url)) },
    { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
  ] },
  test: { include: ["benchmarks/**/*.performance.tsx"], environment: "node", maxWorkers: 1, testTimeout: 600_000 },
});
