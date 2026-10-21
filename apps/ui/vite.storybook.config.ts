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
  // Story transforms discover these controls late; prebundle before browser tests.
  optimizeDeps: { include: ["storybook/theming", "storybook/internal/core-events", "storybook/internal/router", "@base-ui/react/select", "@base-ui/react/switch", "@base-ui/react/tabs",
    "react-markdown", "rehype-katex", "rehype-raw", "rehype-sanitize", "remark-gfm", "remark-math",
    "@base-ui/react/alert-dialog", "@base-ui/react/button", "@base-ui/react/checkbox", "@base-ui/react/combobox", "@base-ui/react/dialog",
    "@lezer/markdown", "@tiptap/extension-image", "@tiptap/extension-list", "@tiptap/extension-mathematics",
    "@tiptap/extension-table", "@tiptap/markdown", "@tiptap/pm/history", "@tiptap/pm/model", "@tiptap/pm/state",
    "@tiptap/pm/tables", "@tiptap/pm/transform", "@tiptap/pm/view", "@tiptap/react", "@tiptap/starter-kit", "katex"] },
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
