import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { addons } from "storybook/preview-api";
import { UPDATE_GLOBALS } from "storybook/internal/core-events";
import { usePreviewAppearance } from "../preview-mode";
import type { PreviewAppearance } from "../preview-appearance";
import { DEFAULT_WEB_APPEARANCE, WebAppearanceContext, WebPaletteStyles, type WebAppearance } from "./WebAppearance";

type PreviewGlobals = PreviewAppearance & { theme: "light" | "dark" };

// The toolbar has two resolved modes; Web settings also retain the system choice.
export function StorybookAppearanceBridge({ children }: { children: ReactNode }) {
  const appearance = usePreviewAppearance();
  const [theme, setTheme] = useState<WebAppearance["theme"]>(appearance.mode);
  const [colors, setColors] = useState<Pick<WebAppearance, "palette" | "neutralPalette">>({ palette: "mono", neutralPalette: "neutral" });
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  const current = useRef(appearance); current.current = appearance;
  const publishing = useRef(false);
  const channel = addons.getChannel();
  const publish = useCallback((globals: PreviewGlobals) => {
    publishing.current = true;
    try { channel.emit(UPDATE_GLOBALS, { globals }); }
    finally { publishing.current = false; }
  }, [channel]);
  useEffect(() => {
    const update = ({ globals }: { globals: Record<string, unknown> }) => {
      if (!publishing.current && (globals.theme === "light" || globals.theme === "dark")) setTheme(globals.theme);
    };
    channel.on(UPDATE_GLOBALS, update);
    return () => { channel.off(UPDATE_GLOBALS, update); };
  }, [channel]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      setSystemDark(media.matches);
      if (theme === "system") {
        const { radius, headingFont, bodyFont } = current.current;
        publish({ radius, headingFont, bodyFont, theme: media.matches ? "dark" : "light" });
      }
    };
    update();
    media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); };
  }, [publish, theme]);
  const onChange = (next: WebAppearance) => {
    setTheme(next.theme);
    setColors({ palette: next.palette, neutralPalette: next.neutralPalette });
    publish({ radius: next.radius, headingFont: next.headingFont, bodyFont: next.bodyFont, theme: next.theme === "system" ? systemDark ? "dark" : "light" : next.theme });
  };
  return <WebAppearanceContext.Provider value={{ value: { ...appearance, ...colors, theme }, onChange, resetAppearance: () => onChange({ ...DEFAULT_WEB_APPEARANCE }) }}><WebPaletteStyles value={colors} />{children}</WebAppearanceContext.Provider>;
}
