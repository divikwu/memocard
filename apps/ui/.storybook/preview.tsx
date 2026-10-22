import type { Preview } from "@storybook/react-vite";
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ArgTypes, Description, DocsContainer, DocsContext, Primary, Stories, Subtitle, Title, useOf, type StoryProps } from "@storybook/addon-docs/blocks";
import { themes } from "storybook/theming";
import { GLOBALS_UPDATED, UPDATE_GLOBALS } from "storybook/internal/core-events";
import { buildArgsParam } from "storybook/internal/router";
import type { GlobalsUpdatedPayload } from "storybook/internal/types";
import { ThemeProvider, useTheme } from "../src/features/theme/ThemeProvider";
import { parseAppearance } from "../src/features/theme/preferences";
import { applyAppearance } from "../src/features/theme/apply-appearance";
import { loadFonts } from "../src/features/theme/font-loader";
import { desktopGlobals, mobileViewport, viewportOptions } from "./viewports";
import { resetStorybookBridge } from "./bridge";
import { observeDocsStoryLayout } from "./docs-story-layout";
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

function useDocsGlobals(context: ComponentProps<typeof DocsContainer>["context"]) {
  const [globals, setGlobals] = useState(() => context.getStoryContext(context.componentStories()[0]).globals);
  useEffect(() => {
    const update = (event: GlobalsUpdatedPayload) => setGlobals(event.globals);
    context.channel.on(GLOBALS_UPDATED, update);
    return () => { context.channel.off(GLOBALS_UPDATED, update); };
  }, [context.channel]);
  return globals;
}

function ProductDocsContainer({ children, context }: ComponentProps<typeof DocsContainer>) {
  const globals = useDocsGlobals(context);
  const defaults = context.getStoryContext(context.componentStories()[0]).parameters.appearance;
  const appearance = parseAppearance(JSON.stringify({ ...defaults, ...globals }));
  const resolved = appearance.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : appearance.theme;
  useEffect(() => { void loadFonts([appearance.headingFont, appearance.bodyFont]).catch(() => undefined); }, [appearance.headingFont, appearance.bodyFont]);
  useLayoutEffect(() => { applyAppearance(document.documentElement, appearance, resolved); }, [appearance, resolved]);
  return <DocsContainer context={context} theme={{ ...themes[resolved], fontBase: "var(--font-sans)", fontCode: "var(--font-mono)" }}>{children}</DocsContainer>;
}

function StoryAppearance({ globals, children }: { globals: Record<string, unknown>; children: ReactNode }) {
  const { setAppearance } = useTheme();
  const appearance = JSON.stringify(parseAppearance(JSON.stringify(globals)));
  useLayoutEffect(() => { setAppearance(parseAppearance(appearance)); }, [appearance, setAppearance]);
  return children;
}

export function StorybookTheme({ globals, children }: { globals: Record<string, unknown>; children: ReactNode }) {
  return <ThemeProvider><StoryAppearance globals={globals}>{children}</StoryAppearance></ThemeProvider>;
}

// Storybook 10.6.2 ignores docs.story.autoplay for iframe stories.
// Its supported embed mode suppresses play while retaining document isolation.
function DocsStoryPreview({ of, height, __primary }: StoryProps) {
  const { story } = useOf(of ?? "story", ["story"]);
  const context = useContext(DocsContext);
  const globals = useDocsGlobals(context);
  const serializedGlobals = JSON.stringify(globals);
  const globalsParam = buildArgsParam({}, globals);
  const [initialGlobals] = useState(globalsParam);
  const iframe = useRef<HTMLIFrameElement>(null);
  const autoHeight = story.parameters.docs?.story?.autoHeight === true;
  const centered = story.parameters.docs?.story?.centered === true;
  const disabled = story.parameters.docs?.disable;
  useEffect(() => {
    const frame = iframe.current;
    if ((!autoHeight && !centered) || disabled || !frame) return;
    return observeDocsStoryLayout(frame, { autoHeight, centered });
  }, [autoHeight, centered, disabled, story.id]);
  useEffect(() => {
    const frame = iframe.current;
    if (!frame || disabled) return;
    // Forward Storybook's channel event to the same-origin isolated preview,
    // including lazy frames that finish loading after the toolbar changes.
    const update = () => frame.contentWindow?.postMessage({
      key: "storybook-channel",
      event: { type: UPDATE_GLOBALS, args: [{ globals: JSON.parse(serializedGlobals) }], from: "button-docs" },
    }, window.location.origin);
    frame.addEventListener("load", update);
    update();
    return () => frame.removeEventListener("load", update);
    // The serialized key avoids echoing identical GLOBALS_UPDATED payloads.
  }, [serializedGlobals, disabled]);
  if (story.parameters.docs?.disable) return null;
  const source = new URL("iframe.html", window.location.href);
  source.searchParams.set("id", story.id);
  source.searchParams.set("viewMode", "story");
  source.searchParams.set("embed", "true");
  source.searchParams.set("globals", initialGlobals);
  const mobile = story.tags.includes("mobile");
  return <div id={`story--${story.id}${__primary ? "--primary" : ""}`} className="sb-story sb-unstyled" data-story-block="true">
    <iframe ref={iframe} id={`iframe--${story.id}`} title={story.name} src={source.href} loading="lazy" allowFullScreen
      style={{ width: mobile ? `${mobileViewport.width}px` : "100%", maxWidth: "100%", height: height ?? story.parameters.docs?.story?.height ?? "320px", border: 0 }} />
  </div>;
}

function StaticDocsPage() {
  return <>
    <Title /><Subtitle /><Description />
    <p>Docs 用于静态对照；切换 Canvas，在 Controls 中调整参数并运行交互。</p>
    <Primary /><ArgTypes /><Stories includePrimary={false} />
  </>;
}

const preview: Preview = {
  tags: ["autodocs"],
  globalTypes: {
    headingFont: { description: "标题字体；未指定时沿用当前示例默认值" },
    bodyFont: { description: "正文字体；未指定时沿用当前示例默认值" },
    theme: { description: "产品明暗主题", toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true } },
    palette: { description: "强调色", toolbar: { icon: "paintbrush", items: ["mono", "lime", "green", "emerald", "teal", "cyan", "sky", "blue"], dynamicTitle: true } },
    radius: { description: "圆角设置", toolbar: { items: ["none", "xs", "sm", "md", "lg", "xl", "2xl"], dynamicTitle: true } },
  },
  initialGlobals: { theme: "light", palette: "mono", radius: "lg", ...desktopGlobals },
  parameters: {
    layout: "fullscreen",
    appearance: { headingFont: "noto-sans-sc", bodyFont: "noto-sans-sc" },
    // ThemeProvider owns document-level styles; Docs stories need separate documents too.
    docs: { container: ProductDocsContainer, page: StaticDocsPage, canvas: { withToolbar: false }, story: { inline: false, height: "320px", autoplay: false }, components: { Story: DocsStoryPreview } },
    controls: { expanded: true },
    viewport: { options: viewportOptions },
    options: { storySort: { order: ["foundations", ["all tokens", "colors", "elevation", "icons", "motion", "shape", "spacing", "typography", "sizing"], "components", "sidebar", "business"] } },
  },
  beforeEach: () => {
    resetStorybookBridge();
    // Each story gets temporary storage. No real preferences are read or written,
    // even when a developer hosts Storybook on an existing origin.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
    localStorage.setItem("memocard:tags:storybook-sidebar", JSON.stringify({ pinned: [], icons: { "体验": "🧭" } }));
    return () => {
      resetStorybookBridge();
      if (original) Object.defineProperty(window, "localStorage", original);
      else Reflect.deleteProperty(window, "localStorage");
    };
  },
  decorators: [(Story, context) => {
    return <StorybookTheme globals={{ ...context.parameters.appearance, ...context.globals }}><Story /></StorybookTheme>;
  }],
};
export default preview;
