import { useLayoutEffect } from "react";
import type { ThemeStyles } from "./theme-types";

// A prebuilt stylesheet needs only its name; runtime definitions also supply CSS.
export function ThemeStyle({ definition }: { definition?: ThemeStyles }) {
  const name = definition?.name, cssText = definition?.cssText;
  useLayoutEffect(() => {
    if (!name) return;
    const root = document.documentElement;
    const previous = root.getAttribute("data-memocard-theme");
    const style = cssText ? document.createElement("style") : undefined;
    if (style) {
      style.dataset.memocardTheme = name;
      style.textContent = cssText!;
      document.head.append(style);
    }
    root.setAttribute("data-memocard-theme", name);
    return () => {
      style?.remove();
      if (previous === null) root.removeAttribute("data-memocard-theme");
      else root.setAttribute("data-memocard-theme", previous);
    };
  }, [name, cssText]);
  return null;
}
