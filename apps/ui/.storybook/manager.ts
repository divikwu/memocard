import { addons } from "storybook/manager-api";

// Keep the existing routes and tests; sizing is an internal regression reference.
addons.setConfig({
  sidebar: {
    filters: {
      sizing: item => item.id !== "foundations-sizing" && !item.id.startsWith("foundations-sizing--"),
    },
  },
});
