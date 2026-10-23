import { uiNextStyleBoundary } from "./vite.ui-next-boundary.ts";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./ui-next", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./node_modules/.vite-ui-next", import.meta.url)),
  resolve: { alias: { "@ui-next": path.join(uiRoot, "ui-next"), "@": path.join(uiRoot, "src") } },
  optimizeDeps: { include: ["react-markdown", "rehype-katex", "rehype-raw", "rehype-sanitize", "remark-gfm", "remark-math"] },
  plugins: [uiNextStyleBoundary(), {
    name: "isolated-ui-next-data",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return;
      const resolved = source.startsWith("@/") ? path.join(uiRoot, "src", source.slice(2))
        : source.startsWith(".") ? path.resolve(path.dirname(importer.split("?")[0]), source) : "";
      if (["bridge", "browser-runtime", "client-mode"].some(name => resolved.replace(/\.[tj]sx?$/, "") === path.join(uiRoot, "src", name))) return path.join(uiRoot, ".storybook/bridge.ts");
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/")) {
          res.statusCode = 403;
          res.end("UI-next Storybook uses fixtures; real data APIs are unavailable.");
          return;
        }
        next();
      });
    },
  }, react(), tailwindcss()],
});
