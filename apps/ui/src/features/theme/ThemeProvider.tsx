/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { FONT_FAMILIES, type FontChoice } from "@/lib/font-options";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, parseAppearance, type Appearance, type NeutralPalette, type Palette, type RadiusChoice, type Theme } from "./preferences";
import { loadFonts } from "./font-loader";

type ThemeContextValue = Appearance & {
  setTheme: (value: Theme) => void;
  setPalette: (value: Palette) => void;
  setNeutralPalette: (value: NeutralPalette) => void;
  setHeadingFont: (value: FontChoice) => void;
  setBodyFont: (value: FontChoice) => void;
  setRadius: (value: RadiusChoice) => void;
  resetAppearance: () => void;
  persistenceError: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function readAppearance() {
  try {
    return { appearance: parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY)), persistenceError: false };
  } catch {
    return { appearance: { ...DEFAULT_APPEARANCE }, persistenceError: true };
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readAppearance);
  const { appearance, persistenceError } = state;
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(COLOR_SCHEME_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(COLOR_SCHEME_QUERY);
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    void loadFonts([appearance.headingFont, appearance.bodyFont]).catch(() => undefined);
  }, [appearance.headingFont, appearance.bodyFont]);

  useLayoutEffect(() => {
    const transitionStyle = document.createElement("style");
    transitionStyle.dataset.memocardThemeTransition = "";
    transitionStyle.textContent = "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}";
    document.head.appendChild(transitionStyle);
    const root = document.documentElement;
    const resolved = appearance.theme === "system" ? (systemDark ? "dark" : "light") : appearance.theme;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    root.dataset.palette = appearance.palette;
    root.dataset.neutralPalette = appearance.neutralPalette;
    root.dataset.headingFont = appearance.headingFont;
    root.dataset.bodyFont = appearance.bodyFont;
    root.dataset.radius = appearance.radius;
    root.style.setProperty("--app-font-heading", FONT_FAMILIES[appearance.headingFont]);
    root.style.setProperty("--app-font-body", FONT_FAMILIES[appearance.bodyFont]);
    // Settle the new colors before restoring component transitions, as in Becoming.
    void window.getComputedStyle(document.body).color;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => transitionStyle.remove());
    });
    return () => {
      window.cancelAnimationFrame(frame);
      transitionStyle.remove();
    };
  }, [appearance, systemDark]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== APPEARANCE_STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== localStorage) return;
        setState({ appearance: parseAppearance(event.newValue), persistenceError: false });
      } catch { /* The current window still retains its chosen appearance. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const save = useCallback((next: Appearance) => {
    let failed = false;
    try { localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next)); }
    catch { failed = true; }
    setState({ appearance: next, persistenceError: failed });
  }, []);

  const value: ThemeContextValue = {
    ...appearance,
    setTheme: (theme) => save({ ...appearance, theme }),
    setPalette: (palette) => save({ ...appearance, palette }),
    setNeutralPalette: (neutralPalette) => save({ ...appearance, neutralPalette }),
    setHeadingFont: (headingFont) => save({ ...appearance, headingFont }),
    setBodyFont: (bodyFont) => save({ ...appearance, bodyFont }),
    setRadius: (radius) => save({ ...appearance, radius }),
    resetAppearance: () => save({ ...DEFAULT_APPEARANCE }),
    persistenceError,
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
