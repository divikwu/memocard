import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { DEFAULT_PREVIEW_APPEARANCE, parsePreviewAppearance, type PreviewAppearance } from "../preview-appearance";
import { PreviewModeProvider } from "../preview-mode";
import "../preview-appearance.css";
import "./web-palette.css";

export const WEB_PALETTES = [
  { value: "mono", label: "黑白" }, { value: "lime", label: "青柠" }, { value: "green", label: "绿色" }, { value: "emerald", label: "翠绿" },
  { value: "teal", label: "青绿" }, { value: "cyan", label: "青色" }, { value: "sky", label: "天蓝" }, { value: "blue", label: "蓝色" },
] as const;
export const WEB_NEUTRALS = [{ value: "neutral", label: "中性灰" }, { value: "slate", label: "冷灰" }] as const;
export type WebAppearance = PreviewAppearance & { theme: "light" | "dark" | "system"; palette: (typeof WEB_PALETTES)[number]["value"]; neutralPalette: (typeof WEB_NEUTRALS)[number]["value"] };
export type WebAppearanceControls = { value: WebAppearance; onChange: (value: WebAppearance) => void; resetAppearance: () => void; persistenceError?: boolean };
export const WebAppearanceContext = createContext<WebAppearanceControls | null>(null);
const storageKey = "memocard-web-appearance-v1";
const legacyStorageKey = "memocard-appearance-v1";
export const DEFAULT_WEB_APPEARANCE: WebAppearance = { ...DEFAULT_PREVIEW_APPEARANCE, theme: "light", palette: "mono", neutralPalette: "neutral" };
const legacyRadii: Record<string, PreviewAppearance["radius"]> = { none: "none", xs: "legacy-xs", sm: "legacy-sm", md: "default", lg: "medium", xl: "legacy-xl", "2xl": "legacy-2xl" };

function parse(raw: string | null, legacy = false): WebAppearance {
  try {
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== "object" || Array.isArray(data)) return DEFAULT_WEB_APPEARANCE;
    return { ...parsePreviewAppearance(legacy ? { ...data, radius: legacyRadii[data.radius] } : data), theme: ["light", "dark", "system"].includes(data.theme) ? data.theme : "light",
      palette: WEB_PALETTES.find(option => option.value === data.palette)?.value ?? "mono", neutralPalette: WEB_NEUTRALS.find(option => option.value === data.neutralPalette)?.value ?? "neutral" };
  } catch { return DEFAULT_WEB_APPEARANCE; }
}

export function WebPaletteStyles({ value }: { value: Pick<WebAppearance, "palette" | "neutralPalette"> }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = { palette: root.dataset.webPalette, neutral: root.dataset.webNeutral };
    root.dataset.webPalette = value.palette;
    root.dataset.webNeutral = value.neutralPalette;
    return () => {
      if (previous.palette === undefined) delete root.dataset.webPalette; else root.dataset.webPalette = previous.palette;
      if (previous.neutral === undefined) delete root.dataset.webNeutral; else root.dataset.webNeutral = previous.neutral;
    };
  }, [value.palette, value.neutralPalette]);
  return null;
}

export function WebAppearanceProvider({ children }: { children: ReactNode }) {
  const [{ value, persistenceError }, setState] = useState(() => {
    try { const raw = localStorage.getItem(storageKey); return { value: raw === null ? parse(localStorage.getItem(legacyStorageKey), true) : parse(raw), persistenceError: false }; }
    catch { return { value: DEFAULT_WEB_APPEARANCE, persistenceError: true }; }
  });
  const [systemDark, setSystemDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== legacyStorageKey && event.key !== null) return;
      try { if (event.storageArea !== localStorage) return; }
      catch { return; }
      try {
        if (event.key === legacyStorageKey && localStorage.getItem(storageKey) !== null) return;
        const value = event.key === null ? DEFAULT_WEB_APPEARANCE : event.key === legacyStorageKey ? parse(event.newValue, true) : event.newValue === null ? parse(localStorage.getItem(legacyStorageKey), true) : parse(event.newValue);
        setState({ value, persistenceError: false });
      } catch { /* The current session retains its last usable choices. */ }
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  const onChange = (next: WebAppearance) => {
    let persistenceError = false;
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { persistenceError = true; }
    setState({ value: next, persistenceError });
  };
  const mode = value.theme === "system" ? systemDark ? "dark" : "light" : value.theme;
  return <WebAppearanceContext.Provider value={{ value, onChange, resetAppearance: () => onChange({ ...DEFAULT_WEB_APPEARANCE }), persistenceError }}><PreviewModeProvider mode={mode} appearance={value}><WebPaletteStyles value={value} />{children}</PreviewModeProvider></WebAppearanceContext.Provider>;
}

export function useWebAppearance() { return useContext(WebAppearanceContext); }
