import type { Preview } from "@storybook/react-vite";
import { ThemeProvider } from "../src/features/theme/ThemeProvider";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "../src/features/theme/preferences";
import "./preview.css";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    theme: { description: "产品明暗主题", toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true } },
    palette: { description: "强调色", toolbar: { icon: "paintbrush", items: ["mono", "lime", "green", "emerald", "teal", "cyan", "sky", "blue"], dynamicTitle: true } },
    radius: { description: "圆角设置", toolbar: { items: ["none", "xs", "sm", "md", "lg", "xl", "2xl"], dynamicTitle: true } },
  },
  initialGlobals: { theme: "light", palette: "mono", radius: "lg" },
  parameters: {
    layout: "fullscreen",
    // ThemeProvider owns document-level styles; Docs stories need separate documents too.
    docs: { story: { inline: false, height: "320px" } },
    controls: { expanded: true },
    viewport: { options: { mobile: { name: "H5 · 390 × 844", styles: { width: "390px", height: "844px" }, type: "mobile" } } },
    options: { storySort: { order: ["foundations", "sidebar"] } },
  },
  beforeEach: () => {
    // Each story gets temporary storage. No real preferences are read or written,
    // even when a developer hosts Storybook on an existing origin.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    const originalCookie = Object.getOwnPropertyDescriptor(document, "cookie");
    Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
    // Cookies share a hostname across ports; sidebar toggles must stay preview-only too.
    Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} });
    localStorage.setItem("memocard:tags:storybook-sidebar", JSON.stringify({ pinned: [], icons: { "体验": "🧭" } }));
    return () => {
      if (original) Object.defineProperty(window, "localStorage", original);
      else Reflect.deleteProperty(window, "localStorage");
      if (originalCookie) Object.defineProperty(document, "cookie", originalCookie);
      else Reflect.deleteProperty(document, "cookie");
    };
  },
  decorators: [(Story, context) => {
    const appearance = { ...DEFAULT_APPEARANCE, ...context.globals };
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    return <ThemeProvider key={`${appearance.theme}-${appearance.palette}-${appearance.radius}`}><Story /></ThemeProvider>;
  }],
};
export default preview;
