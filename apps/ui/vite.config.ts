import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [react(), tailwindcss(), {
    name: "native-content-policy",
    apply: "build",
    transformIndexHtml: () => [{
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: "default-src 'none'; script-src 'self' memocard-ui:; style-src 'self' memocard-ui: 'unsafe-inline'; font-src 'self' memocard-ui:; img-src 'self' memocard-asset: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'",
      },
      injectTo: "head-prepend",
    }],
  }],
  build: { target: "safari16.4", assetsInlineLimit: 0 },
});
