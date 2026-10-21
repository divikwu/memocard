import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    storybookFontTestUrl: string;
  }
}

// Real-page font tests must not depend on a developer's running Storybook.
export default async function setup(project: TestProject) {
  if (process.env.STORYBOOK_FONT_TEST_URL) {
    project.provide("storybookFontTestUrl", process.env.STORYBOOK_FONT_TEST_URL);
    return;
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  await access(new URL("../storybook-static/iframe.html", import.meta.url)).catch(() => {
    throw new Error("Build Storybook before running font regressions: pnpm --filter @memocard/ui build:storybook");
  });
  const server = await preview({ configFile: false, root, build: { outDir: "storybook-static" }, preview: { host: "127.0.0.1", port: 0 } });
  project.provide("storybookFontTestUrl", server.resolvedUrls!.local[0]);
  return () => server.close();
}
