import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import { playwright } from "@vitest/browser-playwright";
import type { CDPSession, Page } from "playwright";
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
const setForcedColors: BrowserCommand<["active" | "none"], void> = async ({ page }, forcedColors) => {
  await page.emulateMedia({ forcedColors });
};
const setFontsOffline: BrowserCommand<[boolean], void> = async ({ page }, offline) => {
  if (offline) await page.route("**/*.woff2*", route => route.abort());
  else await page.unroute("**/*.woff2*");
};
const touchSessions = new WeakMap<Page, CDPSession>();
const setTouchInput: BrowserCommand<[boolean], void> = async ({ page }, enabled) => {
  let session = touchSessions.get(page);
  if (!enabled && !session) return;
  session ??= await page.context().newCDPSession(page);
  touchSessions.set(page, session);
  try { await session.send("Emulation.setTouchEmulationEnabled", { enabled, maxTouchPoints: 1 }); }
  finally { if (!enabled) { touchSessions.delete(page); await session.detach(); } }
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
        optimizeDeps: { include: ["storybook/test", "@hugeicons/core-free-icons/ArrowUpRight01Icon", "@hugeicons/core-free-icons/HashIcon", "@hugeicons/core-free-icons/ImageAdd01Icon", "@hugeicons/core-free-icons/TelegramIcon", "@hugeicons/core-free-icons/ArrowLeft02Icon", "@hugeicons/core-free-icons/Edit02Icon", "@hugeicons/core-free-icons/PinOffIcon", "@hugeicons/core-free-icons/RefreshIcon", "page-mascot", "@tiptap/pm/history", "@tiptap/pm/model", "@tiptap/pm/state", "@tiptap/pm/transform", "@tiptap/pm/view", "@tiptap/react"] },
        test: {
          name: "ui-quality",
          include: ["test-support/ui-quality.browser.tsx", "test-support/note-typography.browser.tsx"],
          browser: { enabled: true, provider: playwright(), commands: { setReducedMotion, setForcedColors, setFontsOffline, setTouchInput }, headless: true, instances: qualityBrowsers.map(browser => ({ browser })), viewport: desktop, screenshotDirectory },
        },
      },
    ],
  },
}));
