import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.storybook.config.ts";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const configDir = fileURLToPath(new URL("./.storybook", import.meta.url));
const viewportSetup = fileURLToPath(new URL("./test-support/viewport.setup.ts", import.meta.url));
const screenshotDirectory = fileURLToPath(new URL("../../build/verification/storybook", import.meta.url));
const desktop = { width: 1024, height: 900 };
const mobile = { width: 390, height: 844 };
// Keep the existing CI font/layout engine matrix; local Firefox remains opt-in.
const qualityBrowsers = process.env.CI || process.env.STORYBOOK_FIREFOX === "1"
  ? ["chromium", "firefox", "webkit"] as const
  : ["chromium", "webkit"] as const;

const setReducedMotion: BrowserCommand<["reduce" | "no-preference"], void> = async ({ page }, reducedMotion) => {
  await page.emulateMedia({ reducedMotion });
};
const setFontsOffline: BrowserCommand<[boolean], void> = async ({ page }, offline) => {
  if (offline) await page.route("**/*.woff2*", route => route.abort());
  else await page.unroute("**/*.woff2*");
};

export default mergeConfig(viteConfig, defineConfig({
  root: uiRoot,
  test: {
    fileParallelism: false,
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir, tags: { exclude: ["mobile"] } })],
        test: {
          name: "storybook-desktop",
          setupFiles: [viewportSetup],
          provide: { storybookViewport: desktop },
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: desktop, screenshotDirectory },
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir, tags: { include: ["mobile"] } })],
        test: {
          name: "storybook-mobile",
          setupFiles: [viewportSetup],
          provide: { storybookViewport: mobile },
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: mobile, screenshotDirectory },
        },
      },
      {
        extends: true,
        test: {
          name: "ui-quality",
          include: ["test-support/ui-quality.browser.tsx"],
          browser: { enabled: true, provider: playwright(), commands: { setReducedMotion, setFontsOffline }, headless: true, instances: qualityBrowsers.map(browser => ({ browser })), viewport: desktop, screenshotDirectory },
        },
      },
    ],
  },
}));
