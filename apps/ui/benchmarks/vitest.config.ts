import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { dedupe: ["react"], alias: [
    { find: "@ui", replacement: fileURLToPath(new URL("../ui", import.meta.url)) },
    { find: "../ui/business/tag-navigation", replacement: process.env.MEMOCARD_TAG_BENCH_SOURCE || fileURLToPath(new URL("../ui/business/tag-navigation.tsx", import.meta.url)) },
    { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
  ] },
  test: { include: ["benchmarks/**/*.performance.tsx"], environment: "node", maxWorkers: 1, testTimeout: 600_000 },
});
