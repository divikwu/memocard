import { useLayoutEffect, type ReactNode } from "react";
import { TypographyProvider } from "../../src/features/typography/TypographyProvider";
import { loadPreviewFonts, type PreviewFont } from "../preview-fonts";
import "./web-typography.css";

// Note preferences retain system Chinese fallback, independently of UI fonts.
const loadNoteFonts = (fonts: PreviewFont[]) => loadPreviewFonts(fonts, false);

export function WebTypographyProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-web-typography", "");
    return () => document.documentElement.removeAttribute("data-web-typography");
  }, []);
  return <TypographyProvider fontLoader={loadNoteFonts}>{children}</TypographyProvider>;
}
