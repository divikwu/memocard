import { uiNextStyleBoundary } from "./vite.ui-next-boundary.ts";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./ui-next/web", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  base: "./",
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "@ui-next": fileURLToPath(new URL("./ui-next", import.meta.url)),
  } },
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
  plugins: [uiNextStyleBoundary(), react(), tailwindcss(), {
    name: "web-content-policy",
    apply: "build",
    transformIndexHtml: () => [{
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
      },
      injectTo: "head-prepend",
    }],
  }],
  build: {
    outDir: fileURLToPath(new URL("./dist-web-next", import.meta.url)),
    emptyOutDir: true,
    manifest: true,
    target: "safari16.4",
    assetsInlineLimit: 0,
    rolldownOptions: { output: { codeSplitting: { groups: [
      // Only consolidate eager vendor modules. Keep local bootstrap modules separate:
      // browser-runtime awaits a dynamic storage graph that imports shared local helpers.
      { name: "initial-vendor", test: /node_modules/, tags: ["$initial"] },
    ] } } },
  },
});
