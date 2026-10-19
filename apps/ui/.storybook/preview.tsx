import type { Preview } from "@storybook/react-vite";
import { useEffect, useRef } from "react";
import { ArgTypes, Description, Primary, Stories, Subtitle, Title, useOf, type StoryProps } from "@storybook/addon-docs/blocks";
import { ThemeProvider } from "../src/features/theme/ThemeProvider";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "../src/features/theme/preferences";
import { desktopGlobals, mobileViewport, viewportOptions } from "./viewports";
import { resetStorybookBridge } from "./bridge";
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

// Storybook 10.6.2 ignores docs.story.autoplay for iframe stories.
// Its supported embed mode suppresses play while retaining document isolation.
function DocsStoryPreview({ of, height, __primary }: StoryProps) {
  const { story } = useOf(of ?? "story", ["story"]);
  const iframe = useRef<HTMLIFrameElement>(null);
  const autoHeight = story.parameters.docs?.story?.autoHeight === true;
  const disabled = story.parameters.docs?.disable;
  useEffect(() => {
    const frame = iframe.current;
    if (!autoHeight || disabled || !frame) return;
    let observer: ResizeObserver | undefined;
    const observeContent = () => {
      observer?.disconnect();
      const content = frame.contentDocument;
      if (!content) return;
      const root = content.getElementById("storybook-root");
      const view = content.defaultView;
      if (!root || !view) return;
      const resize = () => {
        const body = view.getComputedStyle(content.body);
        const pixels = Math.ceil(root.getBoundingClientRect().height + parseFloat(body.paddingTop) + parseFloat(body.paddingBottom));
        frame.style.height = `${pixels}px`;
      };
      // The content root has natural height; body/html can grow to fill the iframe.
      observer = new ResizeObserver(resize);
      observer.observe(root);
      resize();
    };
    frame.addEventListener("load", observeContent);
    observeContent();
    return () => {
      observer?.disconnect();
      frame.removeEventListener("load", observeContent);
    };
  }, [autoHeight, disabled, story.id]);
  if (story.parameters.docs?.disable) return null;
  const source = new URL("iframe.html", window.location.href);
  source.searchParams.set("id", story.id);
  source.searchParams.set("viewMode", "story");
  source.searchParams.set("embed", "true");
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
    theme: { description: "产品明暗主题", toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true } },
    palette: { description: "强调色", toolbar: { icon: "paintbrush", items: ["mono", "lime", "green", "emerald", "teal", "cyan", "sky", "blue"], dynamicTitle: true } },
    radius: { description: "圆角设置", toolbar: { items: ["none", "xs", "sm", "md", "lg", "xl", "2xl"], dynamicTitle: true } },
  },
  initialGlobals: { theme: "light", palette: "mono", radius: "lg", ...desktopGlobals },
  parameters: {
    layout: "fullscreen",
    // ThemeProvider owns document-level styles; Docs stories need separate documents too.
    docs: { page: StaticDocsPage, canvas: { withToolbar: false }, story: { inline: false, height: "320px", autoplay: false }, components: { Story: DocsStoryPreview } },
    controls: { expanded: true },
    viewport: { options: viewportOptions },
    options: { storySort: { order: ["foundations", "components", "sidebar", "business"] } },
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
    const appearance = { ...DEFAULT_APPEARANCE, ...context.globals };
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
    return <ThemeProvider key={`${appearance.theme}-${appearance.palette}-${appearance.radius}`}><Story /></ThemeProvider>;
  }],
};
export default preview;
