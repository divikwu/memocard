import { normalizePath, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

const legacyRoot = normalizePath(fileURLToPath(new URL("./src/", import.meta.url)));

// App shares its controller with the native view. Its unused native view imports
// remain reachable to the bundler; their CSS must never attach to a shared chunk
// and override the new business styles. Shared content (e.g. KaTeX) owns its CSS
// outside src/, and every new view imports its own ui-next styles.
export function uiNextStyleBoundary(): Plugin {
  return {
    name: "ui-next-style-boundary",
    enforce: "pre",
    load(id) {
      const file = normalizePath(id.split("?")[0]);
      if (file.startsWith(legacyRoot) && file.endsWith(".css")) return "";
    },
  };
}
