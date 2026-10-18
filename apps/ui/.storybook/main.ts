import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: fileURLToPath(new URL("../vite.storybook.config.ts", import.meta.url)) } },
  },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};
export default config;
