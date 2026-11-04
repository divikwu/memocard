import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import "./theme-scope.css";

export type ThemeScopeValue = {
  mode?: "light" | "dark";
  themeId?: string;
  layoutId?: string;
  palette?: string;
  neutral?: string;
  style?: CSSProperties;
};
const ThemeScopeContext = createContext<ThemeScopeValue | null>(null);

// Base UI keeps ownership of its portal nodes and focus/inert management.
// Only their attributes change when a scope changes; no portal is reparented.
export function ThemeScope({ value, children }: { value: ThemeScopeValue; children: ReactNode }) {
  const parent = useContext(ThemeScopeContext);
  const defined = Object.fromEntries(Object.entries(value).filter(([, value]) => value !== undefined));
  return <ThemeScopeContext.Provider value={parent || Object.keys(defined).length ? { ...parent, ...defined, style: { ...parent?.style, ...value.style } } : null}>{children}</ThemeScopeContext.Provider>;
}

export function useThemeScopeProps() {
  const scope = useContext(ThemeScopeContext);
  return scope ? {
    className: "ui-theme ui-appearance-scope",
    "data-appearance-scope": "",
    "data-ui-appearance": "",
    "data-ui-theme": scope.mode,
    "data-interface-theme": scope.themeId,
    "data-workspace-layout": scope.layoutId,
    "data-web-palette": scope.palette,
    "data-web-neutral": scope.neutral,
    style: scope.style,
  } : {};
}


export function themeScopeStyle<State>(scope: CSSProperties | undefined, style: CSSProperties | ((state: State) => CSSProperties | undefined) | undefined) {
  return typeof style === "function" ? (state: State) => ({ ...scope, ...style(state) }) : { ...scope, ...style };
}

// Delegated hints originate outside the local React scope of their DOM anchor.
export function themeScopeForElement(element: Element): ThemeScopeValue | undefined {
  const root = element.closest<HTMLElement>("[data-appearance-scope]");
  if (!root) return;
  const style: Record<string, string> = {};
  const computed = getComputedStyle(root);
  for (const name of ["--ui-preview-radius", "--ui-preview-body", "--ui-preview-heading"]) {
    const value = computed.getPropertyValue(name);
    if (value) style[name] = value;
  }
  return { mode: root.dataset.uiTheme as ThemeScopeValue["mode"], themeId: root.dataset.interfaceTheme, layoutId: root.dataset.workspaceLayout, palette: root.dataset.webPalette, neutral: root.dataset.webNeutral, style };
}
