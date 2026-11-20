import { WebTopNavigation } from "../WebTopNavigation";
import { applyAppearanceStyles } from "../appearance/appearance-styles";
import type { LayoutAdapter } from "../appearance/contracts";
import css from "./topbar.css?inline";

applyAppearanceStyles("topbar", css);
export const topbarLayout: LayoutAdapter = { TopNavigation: WebTopNavigation };
