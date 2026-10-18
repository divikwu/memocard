import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.storybook.config.ts";

export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: fileURLToPath(new URL("./.storybook", import.meta.url)), tags: { exclude: ["mobile"] } })],
        test: {
          name: "storybook-desktop",
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: { width: 1024, height: 900 } },
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: fileURLToPath(new URL("./.storybook", import.meta.url)), tags: { include: ["mobile"] } })],
        test: {
          name: "storybook-mobile",
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: { width: 390, height: 844 } },
        },
      },
    ],
  },
}));
