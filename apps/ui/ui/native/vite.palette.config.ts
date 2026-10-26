import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// A dedicated production-token sampler; independent of Storybook and its fixtures.
export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  cacheDir: fileURLToPath(new URL("../../node_modules/.vite-native-palette", import.meta.url)),
  optimizeDeps: { entries: ["ui/native/palette.html"] },
  plugins: [react(), tailwindcss()],
});
