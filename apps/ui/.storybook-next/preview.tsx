import type { Preview } from "@storybook/react-vite";
import { useEffect, useState, type ComponentProps } from "react";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import type { GlobalsUpdatedPayload } from "storybook/internal/types";
import { themes } from "storybook/theming";
import { PreviewModeProvider } from "../ui-next/preview-mode";
import { DEFAULT_PREVIEW_APPEARANCE, parsePreviewAppearance, PREVIEW_RADII } from "../ui-next/preview-appearance";
import { PREVIEW_FONTS } from "../ui-next/preview-fonts";
import { componentDocsRenderer } from "../ui-next/component-docs-renderer";
import "./preview.css";
import "../ui-next/preview-appearance.css";

function ThemeDocsContainer({ children, context }: ComponentProps<typeof DocsContainer>) {
  const [globals, setGlobals] = useState(() =>
    context.getStoryContext(context.componentStories()[0]).userGlobals,
  );
  useEffect(() => {
    const update = (event: GlobalsUpdatedPayload) => setGlobals(event.userGlobals);
    context.channel.on(GLOBALS_UPDATED, update);
    return () => { context.channel.off(GLOBALS_UPDATED, update); };
  }, [context.channel]);
  const mode = globals.theme === "dark" ? "dark" : "light";
  return <PreviewModeProvider mode={mode} appearance={parsePreviewAppearance(globals)}>
    <div data-ui-theme={mode}>
      <DocsContainer context={context} theme={{ ...themes[mode], fontBase: "var(--font-family-body)", fontCode: "var(--font-family-code)" }}>{children}</DocsContainer>
    </div>
  </PreviewModeProvider>;
}

const preview: Preview = {
  globalTypes: {
    theme: { description: "预览主题", toolbar: { icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true } },
    radius: { description: "圆角基准；默认保留项目 8px，显式圆形、胶囊和 chat 角色保持独立", toolbar: { title: "圆角", items: PREVIEW_RADII.filter(({ value }) => value === "default" || value === "none").map(({ value, title }) => ({ value, title })), dynamicTitle: true } },
    headingFont: { description: "标题字体", toolbar: { title: "标题字体", items: [{ value: "inherit", title: "标题 · 跟随正文" }, ...PREVIEW_FONTS.filter(font => font.id === "noto-serif" || font.id === "noto-sans").map(font => ({ value: font.id, title: `标题 · ${font.label}` }))], dynamicTitle: true } },
    bodyFont: { description: "正文字体", toolbar: { title: "正文字体", items: PREVIEW_FONTS.filter(font => font.id === "noto-sans" || font.id === "noto-serif").map(font => ({ value: font.id, title: `正文 · ${font.label}` })), dynamicTitle: true } },
  },
  initialGlobals: { theme: "light", viewport: { value: "desktop", isRotated: false }, ...DEFAULT_PREVIEW_APPEARANCE },
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        desktopWide: { name: "宽屏 · 1440 × 900", styles: { width: "1440px", height: "900px" }, type: "desktop" },
        desktop: { name: "桌面 · 1024 × 900", styles: { width: "1024px", height: "900px" }, type: "desktop" },
        tablet: { name: "平板 · 768 × 1024", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        mobile: { name: "H5 · 390 × 844", styles: { width: "390px", height: "844px" }, type: "mobile" },
      },
    },
    docs: { container: ThemeDocsContainer, renderer: componentDocsRenderer },
    options: {
      storySort: {
        order: ["foundations", ["all tokens", "palette", "colors", "elevation", "icons", "illustrations", "motion", "shape", "spacing", "typography", "typeset"], "components", ["Luma"], "文档模板"],
      },
    },
  },
  decorators: [(Story, context) => <PreviewModeProvider mode={context.globals.theme === "dark" ? "dark" : "light"} appearance={parsePreviewAppearance(context.globals)}><Story /></PreviewModeProvider>],
};
export default preview;
