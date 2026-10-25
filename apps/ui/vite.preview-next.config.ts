import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { uiNextStyleBoundary } from "./vite.ui-next-boundary.ts";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const previewRoot = path.join(uiRoot, "ui-next/preview");
const contentPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' ws://127.0.0.1:*; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
export default defineConfig({
  root: previewRoot,
  publicDir: path.join(uiRoot, "public"),
  cacheDir: path.join(uiRoot, "node_modules/.vite-preview-next"),
  resolve: { alias: { "@": path.join(uiRoot, "src"), "@ui-next": path.join(uiRoot, "ui-next") } },
  plugins: [uiNextStyleBoundary(), {
    name: "isolated-ui-next-preview",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return;
      const resolved = source.startsWith("@/") ? path.join(uiRoot, "src", source.slice(2)) : source.startsWith(".") ? path.resolve(path.dirname(importer.split("?")[0]), source) : "";
      const file = resolved.replace(/\.[tj]sx?$/, "");
      if (["bridge", "client-mode"].some(name => file === path.join(uiRoot, "src", name))) return path.join(previewRoot, "bridge.ts");
      if (file === path.join(uiRoot, "src/browser-runtime")) return path.join(previewRoot, "browser-runtime.ts");
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader("Content-Security-Policy", contentPolicy);
        if (req.url?.split("?")[0].startsWith("/api/")) { res.statusCode = 403; res.end("UI-next Preview has no real data API"); return; }
        next();
      });
    },
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: contentPolicy }, injectTo: "head-prepend" }],
  }, react(), tailwindcss()],
  server: { host: "127.0.0.1", port: 5182, strictPort: true, open: false },
  build: {
    assetsInlineLimit: 0,
    outDir: path.join(uiRoot, "preview-next-static"), emptyOutDir: true,
    rolldownOptions: { input: { index: path.join(previewRoot, "index.html"), client: path.join(previewRoot, "client.html"), mascots: path.join(previewRoot, "mascots.html") } },
  },
});
