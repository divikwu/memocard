import { createContext, useContext, useEffect, useLayoutEffect, useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { DEFAULT_PREVIEW_APPEARANCE, getPreviewRadius, type PreviewAppearance } from "./preview-appearance";
import { getPreviewFont, loadPreviewFonts } from "./preview-fonts";
import { useInputModality } from "./input-modality";

const PreviewFontContext = createContext<{ status: "loading" | "ready" | "failed"; retry: () => void }>({ status: "ready", retry: () => {} });

const PreviewModeContext = createContext<PreviewAppearance & { mode: "light" | "dark" }>({ ...DEFAULT_PREVIEW_APPEARANCE, mode: "light" });

export function previewAppearanceStyle({ radius, headingFont, bodyFont }: PreviewAppearance) {
  return {
    "--ui-preview-radius": getPreviewRadius(radius).radius,
    "--ui-preview-body": getPreviewFont(bodyFont).fontFamily,
    "--ui-preview-heading": getPreviewFont(headingFont === "inherit" ? bodyFont : headingFont).fontFamily,
  } as CSSProperties;
}

export function PreviewModeProvider({ mode, appearance = DEFAULT_PREVIEW_APPEARANCE, children }: { mode: "light" | "dark"; appearance?: PreviewAppearance; children: ReactNode }) {
  useInputModality();
  const { radius, headingFont, bodyFont } = appearance;
  const resolvedHeading = headingFont === "inherit" ? bodyFont : headingFont;
  const [attempt, setAttempt] = useState(0);
  const [fontResult, setFontResult] = useState<{ key: string; status: "ready" | "failed" }>();
  const fontKey = `${bodyFont}:${resolvedHeading}:${attempt}`;
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const status = fontResult?.key === fontKey ? fontResult.status : "loading";
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(previewAppearanceStyle({ radius, headingFont: resolvedHeading, bodyFont }))) root.style.setProperty(name, String(value));
    root.dataset.uiAppearance = "";
    root.dataset.uiTheme = mode;
  }, [mode, radius, resolvedHeading, bodyFont]);
  useEffect(() => {
    let current = true;
    void loadPreviewFonts([bodyFont, resolvedHeading]).then(() => {
      if (current) setFontResult({ key: fontKey, status: "ready" });
    }).catch(error => {
      if (!current) return;
      setFontResult({ key: fontKey, status: "failed" });
      console.error("MemoCard UI 字体加载失败，暂时使用回退字体。", error);
    });
    return () => { current = false; };
  }, [bodyFont, resolvedHeading, fontKey]);
  return <PreviewModeContext.Provider value={{ mode, radius, headingFont, bodyFont }}><PreviewFontContext.Provider value={{ status, retry }}>{children}</PreviewFontContext.Provider></PreviewModeContext.Provider>;
}

export function usePreviewMode() {
  return useContext(PreviewModeContext).mode;
}

export function usePreviewAppearance() {
  return useContext(PreviewModeContext);
}

export function usePreviewGlobalsParam() {
  const { mode, radius, headingFont, bodyFont } = usePreviewAppearance();
  return `theme:${mode};radius:${radius};headingFont:${headingFont};bodyFont:${bodyFont}`;
}

export function usePreviewFontStatus() {
  return useContext(PreviewFontContext);
}
