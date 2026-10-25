import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: { dedupe: ["react"], alias: [
    { find: "@ui-next", replacement: fileURLToPath(new URL("../ui-next", import.meta.url)) },
    { find: "../ui-next/business/tag-navigation", replacement: process.env.MEMOCARD_TAG_BENCH_SOURCE || fileURLToPath(new URL("../ui-next/business/tag-navigation.tsx", import.meta.url)) },
    { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
  ] },
  test: { include: ["benchmarks/**/*.performance.tsx"], environment: "node", maxWorkers: 1, testTimeout: 600_000 },
});
