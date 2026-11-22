import type { AppearanceCatalog, AppearanceResolution } from "./contracts";
import { sidebarLayout } from "../layouts/sidebar";
import { applyAppearanceStyles } from "./appearance-styles";
import { interfaceThemeLabels } from "./interface-theme-labels";

const layouts = {
  sidebar: { viewport: "desktop", load: () => Promise.resolve(sidebarLayout) },
  drawer: { viewport: "mobile", load: () => Promise.resolve(sidebarLayout) },
  topbar: { viewport: "desktop", load: () => import("../layouts/topbar").then(module => module.topbarLayout) },
  rail: { viewport: "desktop", load: () => import("../layouts/rail").then(module => module.railLayout) },
} as const satisfies AppearanceCatalog["layouts"];

export const appearanceCatalog = {
  themes: {
    classic: { label: interfaceThemeLabels.classic, layouts: { desktop: "rail", mobile: "drawer" }, loadStyles: () => import("./themes/classic.css?inline").then(({ default: css }) => applyAppearanceStyles("classic", css)) },
    minimal: { label: interfaceThemeLabels.minimal, layouts: { desktop: "topbar", mobile: "drawer" }, loadStyles: () => import("./themes/minimal.css?inline").then(({ default: css }) => applyAppearanceStyles("minimal", css)) },
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
