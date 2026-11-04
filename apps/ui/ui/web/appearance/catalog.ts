import type { AppearanceCatalog, AppearanceResolution } from "./contracts";
import { sidebarLayout } from "../layouts/sidebar";

const layouts = {
  sidebar: { viewport: "desktop", load: () => Promise.resolve(sidebarLayout) },
  drawer: { viewport: "mobile", load: () => Promise.resolve(sidebarLayout) },
  topbar: { viewport: "desktop", load: () => import("../layouts/topbar").then(module => module.topbarLayout) },
} as const satisfies AppearanceCatalog["layouts"];

export const appearanceCatalog = {
  themes: {
    classic: { label: "经典", layouts: { desktop: "sidebar", mobile: "drawer" }, loadStyles: () => Promise.resolve() },
    minimal: { label: "简约", layouts: { desktop: "topbar", mobile: "drawer" }, loadStyles: () => import("./themes/minimal.css") },
  },
  layouts,
} as const satisfies AppearanceCatalog<keyof typeof layouts>;

export function resolveAppearance(catalog: AppearanceCatalog, requested: string, mobile: boolean): AppearanceResolution {
  const known = Object.hasOwn(catalog.themes, requested);
  const themeId = known ? requested : "classic";
  const layoutId = catalog.themes[themeId].layouts[mobile ? "mobile" : "desktop"];
  const supported = Object.hasOwn(catalog.layouts, layoutId) && catalog.layouts[layoutId].viewport === (mobile ? "mobile" : "desktop");
  return { themeId, layoutId: supported ? layoutId : mobile ? "drawer" : "sidebar", themeFallback: known ? null : "unknown", layoutFallback: supported ? null : "unsupported-viewport" };
}
