import { WebTopNavigation } from "../WebTopNavigation";
import { applyAppearanceStyles } from "../appearance/appearance-styles";
import type { LayoutAdapter } from "../appearance/contracts";
import desktopCss from "./desktop.css?inline";
import css from "./topbar.css?inline";

applyAppearanceStyles("desktop", desktopCss);
applyAppearanceStyles("topbar", css);
export const topbarLayout: LayoutAdapter = { TopNavigation: WebTopNavigation };
