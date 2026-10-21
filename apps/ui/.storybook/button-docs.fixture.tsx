import { useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { act } from "@testing-library/react";
import { vi } from "vitest";
import { composeStories, setProjectAnnotations, type ReactRenderer } from "@storybook/react-vite";
import { useOf, type StoryProps } from "@storybook/addon-docs/blocks";
import { DocsContext, StoryStore, mockChannel } from "storybook/preview-api";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import * as buttonStories from "../stories/button.stories";
import { observeDocsStoryLayout } from "./docs-story-layout";
import previewCss from "./preview.css?inline";
import notoSansScCss from "@fontsource-variable/noto-sans-sc/wght.css?inline";
import buttonDocsCss from "../stories/button-docs.css?inline";
import preview from "./preview";
import { componentDocsRenderer } from "./component-docs-renderer";

const projectAnnotations = setProjectAnnotations({});
export const buttonDocsStories = composeStories(buttonStories);

// Test-only loading boundary: render real stories into about:blank, without a
// Storybook server. This does not cover the production iframe bootstrap.
export function ButtonStoryFrame({ children, layout = "padded", autoHeight = false, centered = false, height = "320px", title }: {
  children: ReactNode; layout?: string; autoHeight?: boolean; centered?: boolean; height?: string; title: string;
}) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const content = frame?.contentDocument;
    if (!content) return;
    const style = content.createElement("style");
    style.textContent = `${previewCss}\n${buttonDocsCss}\n${notoSansScCss}`;
    content.head.append(style);
    // Portaled stories use the outer document's ThemeProvider. Mirror its
    // appearance on this iframe, as the production iframe bootstrap does.
    const appearanceAttributes = ["class", "style", "data-palette", "data-neutral-palette", "data-radius", "data-heading-font", "data-body-font"];
    const syncAppearance = () => {
      for (const attribute of appearanceAttributes) {
        const value = document.documentElement.getAttribute(attribute);
        if (value === null) content.documentElement.removeAttribute(attribute);
        else content.documentElement.setAttribute(attribute, value);
      }
    };
    syncAppearance();
    const appearanceObserver = new MutationObserver(syncAppearance);
    appearanceObserver.observe(document.documentElement, { attributes: true, attributeFilter: appearanceAttributes });
    Object.assign(content.body.style, { margin: "0", padding: layout === "padded" ? "1rem" : "0", boxSizing: "border-box" });
    const target = content.createElement("div");
    target.id = "storybook-root";
    content.body.append(target);
    setRoot(target);
    return () => { appearanceObserver.disconnect(); target.remove(); style.remove(); };
  }, [frame, layout]);
  useLayoutEffect(() => {
    if (frame && root && (autoHeight || centered)) return observeDocsStoryLayout(frame, { autoHeight, centered });
  }, [frame, root, autoHeight, centered]);
  return <><iframe ref={setFrame} title={title} style={{ width: "100%", height, border: 0 }} />{root && createPortal(children, root)}</>;
}

function FixtureStory({ of, height }: StoryProps) {
  const { story } = useOf(of ?? "story", ["story"]);
  const ComposedStory = Object.values(buttonDocsStories).find(item => item.id === story.id);
  if (!ComposedStory) throw new Error(`Unexpected Button story: ${story.id}`);
  return <ButtonStoryFrame title={story.name} layout={story.parameters.layout} height={height ?? story.parameters.docs?.story?.height}
    autoHeight={story.parameters.docs?.story?.autoHeight} centered={story.parameters.docs?.story?.centered}><ComposedStory /></ButtonStoryFrame>;
}

export async function renderButtonDocs(element: HTMLElement) {
  const importPath = "./stories/button.stories.tsx";
  const entries = Object.fromEntries(Object.values(buttonDocsStories).map(story => [story.id, {
    id: story.id, title: buttonStories.default.title, name: story.storyName, type: "story" as const, subtype: "story" as const, importPath,
  }]));
  // This test-only DocsContext adapter follows the pinned Storybook 10.6.2 API.
  const store = new StoryStore<ReactRenderer>({ v: 5, entries }, async () => buttonStories, projectAnnotations);
  const csf = store.processCSFFileWithCache(buttonStories, importPath, buttonStories.default.title);
  const channel = mockChannel();
  const context = new DocsContext(channel, store, () => { throw new Error("The fixture must not load Storybook iframes."); }, [csf]);
  context.attachCSFFile(csf);
  const renderer = await componentDocsRenderer();
  const parameters = { ...buttonStories.default.parameters.docs, container: preview.parameters!.docs.container, components: { Story: FixtureStory } };
  await act(async () => { await renderer.render(context, parameters, element); });
  // DocsRenderer's first commit can still contain Source's lazy highlighter.
  // Settle that real import and its React commit before testing tab state.
  await act(async () => { await vi.dynamicImportSettled(); });
  return Object.assign(() => { act(() => renderer.unmount(element)); }, {
    rerender: () => act(async () => { await renderer.render(context, parameters, element); }),
    updateGlobals: (globals: Record<string, unknown>) => act(() => channel.emit(GLOBALS_UPDATED, { globals, initialGlobals: {} })),
  });
}
