import { WebDetailNavigation, WebRailNavigation } from "../WebRailNavigation";
import { applyAppearanceStyles } from "../appearance/appearance-styles";
import type { LayoutAdapter } from "../appearance/contracts";
import desktopCss from "./desktop.css?inline";
import css from "./rail.css?inline";

applyAppearanceStyles("desktop", desktopCss);
applyAppearanceStyles("rail", css);
export const railLayout: LayoutAdapter = { TopNavigation: WebRailNavigation, DetailNavigation: WebDetailNavigation };
