import { useLayoutEffect, type ReactNode } from "react";
import { TypographyProvider } from "../../src/features/typography/TypographyProvider";
import "./web-typography.css";

export function WebTypographyProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-web-typography", "");
    return () => document.documentElement.removeAttribute("data-web-typography");
  }, []);
  return <TypographyProvider>{children}</TypographyProvider>;
}
