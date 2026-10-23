import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../ui-next/stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: fileURLToPath(new URL("../vite.storybook-next.config.ts", import.meta.url)) } },
  },
  core: { disableTelemetry: true },
  features: { sidebarOnboardingChecklist: false },
};
export default config;
