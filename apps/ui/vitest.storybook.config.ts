import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.storybook.config.ts";
import { desktopViewport, mobileViewport } from "./.storybook/viewports.ts";
import { verifyDocsFont } from "./.storybook/docs-font-regression.ts";
import { verifyComponentFont } from "./.storybook/component-font-regression.ts";
import { verifyFoundationReference } from "./.storybook/foundation-reference-regression.ts";
import { verifyTokenDocs } from "./.storybook/token-docs-regression.ts";

// CI runs the full matrix; local Firefox can be opted in (macOS 27 may fail before page startup).
const typographyBrowsers = process.env.CI || process.env.STORYBOOK_FIREFOX === "1"
  ? ["chromium", "firefox", "webkit"] as const
  : ["chromium", "webkit"] as const;

const viewportSetup = fileURLToPath(new URL("./.storybook/viewport.setup.ts", import.meta.url));

// Change the actual browser media feature, not window.matchMedia or product CSS.
const setReducedMotion: BrowserCommand<["reduce" | "no-preference"], void> = async ({ page }, reducedMotion) => {
  if (reducedMotion !== "reduce" && reducedMotion !== "no-preference") throw new Error("Unsupported motion preference.");
  await page.emulateMedia({ reducedMotion });
};

const setColorScheme: BrowserCommand<["light" | "dark"], void> = async ({ page }, colorScheme) => {
  await page.emulateMedia({ colorScheme });
};

const setPointerPressed: BrowserCommand<[boolean], void> = async ({ page }, pressed) => {
  if (pressed) await page.mouse.down(); else await page.mouse.up();
};

const tabThroughControls: BrowserCommand<[], void> = async ({ page }) => {
  // macOS WebKit uses Option+Tab to include buttons in native keyboard traversal.
  await page.keyboard.press(process.platform === "darwin" && page.context().browser()?.browserType().name() === "webkit" ? "Alt+Tab" : "Tab");
};

export default mergeConfig(viteConfig, defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "theme-tokens",
          include: ["stories/theme-tokens.browser.tsx", "stories/hue-tokens.browser.tsx", "stories/domain-tokens.browser.tsx", "stories/theme-definition.browser.tsx"],
          browser: { enabled: true, provider: playwright(), commands: { setPointerPressed, tabThroughControls, setColorScheme }, headless: true, instances: [{ browser: "chromium" }, { browser: "webkit" }], viewport: desktopViewport },
        },
      },
      {
        extends: true,
        test: {
          name: "motion-tokens",
          include: ["stories/motion-tokens.browser.tsx"],
          browser: { enabled: true, provider: playwright(), commands: { setReducedMotion }, headless: true, instances: [{ browser: "chromium" }, { browser: "webkit" }], viewport: desktopViewport },
        },
      },
      ...typographyBrowsers.map(browser => ({
        extends: true as const,
        test: {
          name: `typography-${browser}`,
          include: ["stories/typography-system.browser.tsx", "stories/density.browser.tsx"],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser }], viewport: desktopViewport },
        },
      })),
      {
        extends: true,
        test: {
          name: "docs-fonts",
          globalSetup: [fileURLToPath(new URL("./.storybook/font-test-server.ts", import.meta.url))],
          sequence: { groupOrder: 8 },
          include: ["stories/docs-fonts.browser.ts", "stories/foundation-reference.browser.ts", "stories/token-docs.browser.ts"],
          browser: { enabled: true, provider: playwright(), commands: { verifyDocsFont, verifyComponentFont, verifyFoundationReference, verifyTokenDocs }, headless: true, instances: [{ browser: "chromium" }] },
        },
      },
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
          sequence: { groupOrder: 1 },
          setupFiles: [viewportSetup],
          provide: { storybookViewport: mobileViewport },
          browser: { enabled: true, provider: playwright(), commands: { setReducedMotion }, headless: true, instances: [{ browser: "chromium" }], viewport: mobileViewport },
        },
      },
      {
        extends: true,
        test: {
          name: "sidebar-breakpoints",
          sequence: { groupOrder: 2 },
          include: ["stories/sidebar.breakpoints.browser.tsx"],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: { width: 768, height: 900 }, screenshotDirectory: fileURLToPath(new URL("../../build/verification/design-system/storybook-breakpoints", import.meta.url)) },
        },
      },
      {
        extends: true,
        test: {
          name: "button-docs",
          sequence: { groupOrder: 3 },
          include: ["stories/button-docs.browser.tsx", "stories/docs-story-layout.browser.tsx"],
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" }], viewport: desktopViewport },
        },
      },
      ...[320, 390].map((width, index) => ({
        extends: true as const,
        test: {
          name: `button-docs-${width}`,
          sequence: { groupOrder: 4 + index },
          include: ["stories/button-docs-responsive.browser.tsx"],
          setupFiles: [viewportSetup],
          provide: { storybookViewport: { width, height: 844 } },
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" as const }], viewport: { width, height: 844 } },
        },
      })),
      ...[320, 390].map((width, index) => ({
        extends: true as const,
        test: {
          name: `component-docs-template-${width}`,
          sequence: { groupOrder: 6 + index },
          include: ["stories/component-docs-template-responsive.browser.tsx"],
          setupFiles: [viewportSetup],
          provide: { storybookViewport: { width, height: 844 } },
          browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: "chromium" as const }], viewport: { width, height: 844 } },
        },
      })),
    ],
  },
}));
