import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.storybook.config.ts";
import { desktopViewport, mobileViewport } from "./.storybook/viewports.ts";

const viewportSetup = fileURLToPath(new URL("./.storybook/viewport.setup.ts", import.meta.url));

// Change the actual browser media feature, not window.matchMedia or product CSS.
const setReducedMotion: BrowserCommand<["reduce" | "no-preference"], void> = async ({ page }, reducedMotion) => {
  if (reducedMotion !== "reduce" && reducedMotion !== "no-preference") throw new Error("Unsupported motion preference.");
  await page.emulateMedia({ reducedMotion });
};

export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: fileURLToPath(new URL("./.storybook", import.meta.url)), tags: { exclude: ["mobile"] } })],
        test: {
          name: "storybook-desktop",
          setupFiles: [viewportSetup],
          provide: { storybookViewport: desktopViewport },
          browser: { enabled: true, provider: playwright(), commands: { setReducedMotion }, headless: true, instances: [{ browser: "chromium" }], viewport: desktopViewport },
        },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: fileURLToPath(new URL("./.storybook", import.meta.url)), tags: { include: ["mobile"] } })],
        test: {
          name: "storybook-mobile",
          setupFiles: [viewportSetup],
          provide: { storybookViewport: mobileViewport },
          browser: { enabled: true, provider: playwright(), commands: { setReducedMotion }, headless: true, instances: [{ browser: "chromium" }], viewport: mobileViewport },
        },
      },
      {
        extends: true,
        test: {
          name: "sidebar-breakpoints",
          include: ["stories/sidebar.breakpoints.browser.tsx"],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: { width: 768, height: 900 }, screenshotDirectory: fileURLToPath(new URL("../../build/verification/design-system/storybook-breakpoints", import.meta.url)) },
        },
      },
    ],
  },
}));
