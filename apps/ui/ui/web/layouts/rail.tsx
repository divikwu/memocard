import { WebDetailNavigation, WebRailNavigation } from "../WebRailNavigation";
import { applyAppearanceStyles } from "../appearance/appearance-styles";
import type { LayoutAdapter } from "../appearance/contracts";
import css from "./rail.css?inline";

applyAppearanceStyles("rail", css);
export const railLayout: LayoutAdapter = { TopNavigation: WebRailNavigation, DetailNavigation: WebDetailNavigation };
