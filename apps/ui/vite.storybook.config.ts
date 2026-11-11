import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./ui", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./node_modules/.vite-ui", import.meta.url)),
  resolve: { alias: { "@ui": path.join(uiRoot, "ui"), "@": path.join(uiRoot, "src") } },
  optimizeDeps: { include: [
    "@tanstack/react-virtual", "react-markdown", "rehype-katex", "rehype-raw", "rehype-sanitize", "remark-gfm", "remark-math",
    ...[
      "Archive02", "ArrowDown02", "ArrowUp02", "ArtificialIntelligence01", "BookOpen01", "Bookmark01", "Briefcase01",
      "CheckmarkCircle02", "Code", "Comment01", "Database01", "Dumbbell01", "Files01", "Fire", "GameController01",
      "Gift", "Grid2x2", "Headphones", "HeartAdd", "Home01", "LaptopMinimal", "Leaf01", "ListChecks", "Location01",
      "Mail01", "Moon02", "MusicNote01", "NotebookTabs", "PaintBrush01", "Presentation01", "Restaurant01", "Rocket01",
      "Settings01", "ShoppingBag01", "SmartPhone01", "Star", "StickyNote01", "Subtitle", "Sun01", "Target01", "Task01",
      "UserGroup", "Video01", "Wallet01", "Wrench01",
    ].map(icon => `@hugeicons/core-free-icons/${icon}Icon`),
  ] },
  plugins: [{
    name: "isolated-ui-data",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return;
      const resolved = source.startsWith("@/") ? path.join(uiRoot, "src", source.slice(2))
        : source.startsWith(".") ? path.resolve(path.dirname(importer.split("?")[0]), source) : "";
      if (["bridge", "browser-runtime", "client-mode"].some(name => resolved.replace(/\.[tj]sx?$/, "") === path.join(uiRoot, "src", name))) return path.join(uiRoot, "test-support/bridge.ts");
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/")) {
          res.statusCode = 403;
          res.end("MemoCard UI Storybook uses fixtures; real data APIs are unavailable.");
          return;
        }
        next();
      });
    },
  }, react(), tailwindcss()],
});
