import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const mock = path.join(root, ".storybook/bridge.ts");

// Deliberately independent of the App's native-content-policy build plugin.
export default defineConfig({
  resolve: { alias: { "@": path.join(root, "src") } },
  plugins: [{
    name: "isolated-storybook-data",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return;
      const resolved = source.startsWith("@/") ? path.join(root, "src", source.slice(2))
        : source.startsWith(".") ? path.resolve(path.dirname(importer.split("?")[0]), source) : "";
      if (["bridge", "browser-runtime", "client-mode"].some(name => resolved.replace(/\.[tj]sx?$/, "") === path.join(root, "src", name))) return mock;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/")) {
          res.statusCode = 403;
          res.end("Storybook uses fixtures; real data APIs are unavailable.");
          return;
        }
        next();
      });
    },
  }, react(), tailwindcss()],
});
