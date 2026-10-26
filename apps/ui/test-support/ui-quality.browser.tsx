import { afterEach, expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { ComponentDocs } from "../ui-next/ComponentDocs";
import { componentDocs, type ComponentKey } from "../ui-next/component-docs.data";
import { Button } from "../ui-next/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui-next/components/sheet";
import { PreviewModeProvider } from "../ui-next/preview-mode";
import { loadPreviewFonts } from "../ui-next/preview-fonts";
import { useNoteImage } from "../src/use-note-image";
import { setStorybookBrowserAssets } from "./bridge";
import "../.storybook-next/preview.css";
import "../ui-next/preview-appearance.css";

afterEach(async () => {
  cleanup();
  await commands.setReducedMotion("no-preference");
  await commands.setFontsOffline(false);
  document.documentElement.removeAttribute("data-ui-next-appearance");
  document.documentElement.removeAttribute("data-ui-theme");
  document.documentElement.removeAttribute("style");
});

for (const width of [320, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`component Docs remain usable at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    for (const component of Object.keys(componentDocs) as ComponentKey[]) {
      const view = render(<PreviewModeProvider mode={theme}><ComponentDocs component={component} /></PreviewModeProvider>);
      for (const tab of ["Overview", "Properties", "Accessibility"]) {
        await userEvent.click(within(view.container).getByRole("tab", { name: tab }));
        await waitFor(() => {
          expect(document.documentElement.scrollWidth, `${component} ${tab} page overflow`).toBeLessThanOrEqual(width + 1);
          const panel = within(view.container).getByRole("tabpanel", { name: tab });
          expect(panel.getBoundingClientRect().width).toBeGreaterThan(0);
        });
      }
      view.unmount();
    }
  }, 60_000);
}

test("theme changes retain editable Docs state and real local Chinese/Latin fonts load", async () => {
  const view = render(<PreviewModeProvider mode="light"><ComponentDocs component="input" /></PreviewModeProvider>);
  const field = within(view.container).getAllByRole("textbox", { name: "名称" })[0];
  await userEvent.fill(field, "保留输入 MemoCard");
  view.rerender(<PreviewModeProvider mode="dark"><ComponentDocs component="input" /></PreviewModeProvider>);
  expect((field as HTMLInputElement).value).toBe("保留输入 MemoCard");
  await loadPreviewFonts(["noto-sans", "noto-serif"]);
  for (const [family, text] of [["Noto Sans Variable", "Aa"], ["Noto Sans SC Variable", "中文"], ["Noto Serif SC Variable", "中文"]]) {
    expect((await document.fonts.load(`400 16px "${family}"`, text)).length).toBeGreaterThan(0);
  }
  expect(getComputedStyle(field).fontFamily).toContain("Noto Sans");
});

test("Properties retains its input and Code view across tabs and appearance changes at 200% text size", async () => {
  await page.viewport(320, 900);
  document.documentElement.style.fontSize = "200%";
  const view = render(<PreviewModeProvider mode="light"><ComponentDocs component="input" /></PreviewModeProvider>);
  const docs = within(view.container);
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  const properties = docs.getByRole("tabpanel", { name: "Properties" });
  const field = within(properties).getByRole("textbox", { name: "名称" });
  await userEvent.fill(field, "保留属性预览");
  await userEvent.click(within(properties).getByRole("button", { name: "切换预览说明与代码" }));
  await userEvent.click(docs.getByRole("tab", { name: "Accessibility" }));
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  view.rerender(<PreviewModeProvider mode="dark" appearance={{ radius: "none", headingFont: "noto-serif", bodyFont: "noto-sans" }}><ComponentDocs component="input" /></PreviewModeProvider>);
  expect(within(properties).getByRole("textbox", { name: "名称" })).toBe(field);
  expect((field as HTMLInputElement).value).toBe("保留属性预览");
  expect(within(properties).getByRole("tab", { name: "Code" }).getAttribute("aria-selected")).toBe("true");
  const link = within(properties).getByRole("link", { name: "在 Canvas 中打开" });
  expect(link.getAttribute("href")).toContain("ui-next-input--example");
  expect(link.getAttribute("href")).toContain("theme:dark;radius:none;headingFont:noto-serif;bodyFont:noto-sans");
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(321);
  expect(field.getBoundingClientRect().width).toBeGreaterThan(0);
});

test("an unavailable font keeps readable fallback content and recovers after retry", async () => {
  await page.viewport(320, 900);
  await commands.setFontsOffline(true);
  await expect(loadPreviewFonts(["geist"], false)).rejects.toThrow();
  const view = render(<p style={{ fontFamily: '"Geist Variable", sans-serif', overflowWrap: "anywhere" }}>字体离线时仍可阅读 MemoCard notes</p>);
  expect(view.container.textContent).toContain("仍可阅读");
  expect(view.container.getBoundingClientRect().height).toBeGreaterThan(0);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(321);
  await commands.setFontsOffline(false);
  await loadPreviewFonts(["geist"], false);
  expect(document.fonts.check('400 16px "Geist Variable"', "Aa")).toBe(true);
});

test("real reduced-motion media removes Sheet transition and Escape restores focus", async () => {
  render(<PreviewModeProvider mode="light"><Sheet><SheetTrigger render={<Button />}>打开抽屉</SheetTrigger><SheetContent><SheetHeader><SheetTitle>动效验收</SheetTitle><SheetDescription>验证系统动态偏好与键盘返回。</SheetDescription></SheetHeader></SheetContent></Sheet></PreviewModeProvider>);
  const trigger = page.getByRole("button", { name: "打开抽屉" });
  await trigger.click();
  await waitFor(() => expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull());
  const dialog = document.querySelector<HTMLElement>('[data-slot="sheet-content"]')!;
  const normal = parseFloat(getComputedStyle(dialog).transitionDuration);
  expect(normal).toBeGreaterThan(0);
  await commands.setReducedMotion("reduce");
  await waitFor(() => expect(parseFloat(getComputedStyle(dialog).transitionDuration)).toBe(0));
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
  await expect.element(page.getByRole("dialog", { name: "动效验收" })).not.toBeInTheDocument();
});

function LazyVaultImage() {
  const { ref, state, onLoaded, onFailed } = useNoteImage("memocard-asset://vault/assets/clipped.png", true);
  return <span data-image-state={state} style={{ display: "block", width: 80, height: 40 }}>
    <img ref={ref} alt="裁切图片" width={80} height={40} loading="lazy" onLoad={onLoaded} onError={onFailed} />
  </span>;
}

test("lazy vault images wait for every ancestor clip and read once after nested scrolling", async () => {
  await page.viewport(800, 600);
  const canvas = document.createElement("canvas");
  canvas.width = 16; canvas.height = 8;
  canvas.getContext("2d")!.fillRect(0, 0, 16, 8);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), "image/png"));
  let reads = 0;
  const releaseAssets = setStorybookBrowserAssets({ get "assets/clipped.png"() { reads++; return blob; } });
  const view = render(<div data-testid="outer-clip" style={{ width: 320, height: 140, overflow: "auto" }}>
    <div style={{ height: 500, paddingTop: 200 }}>
      <div data-testid="inner-clip" style={{ height: 120, overflow: "auto" }}>
        <div style={{ height: 400 }}><div style={{ height: 180 }} />
          <LazyVaultImage />
        </div>
      </div>
    </div>
  </div>);
  const outer = view.getByTestId("outer-clip"), inner = view.getByTestId("inner-clip");
  const image = view.getByRole("img", { name: "裁切图片" }) as HTMLImageElement;
  const intersecting = () => new Promise<boolean>(resolve => {
    const observer = new IntersectionObserver(([entry]) => { observer.disconnect(); resolve(entry.isIntersecting); }, { root: null });
    observer.observe(image.closest("[data-image-state]")!);
  });
  try {
    expect(await intersecting()).toBe(false);
    expect(reads).toBe(0);
    inner.scrollTop = 180;
    expect(await intersecting()).toBe(false);
    expect(reads).toBe(0);
    outer.scrollTop = 200;
    expect(await intersecting()).toBe(true);
    await waitFor(() => { expect(reads).toBe(1); expect(image.naturalWidth).toBe(16); });
    expect(image.getAttribute("width")).toBe("80");
    expect(image.getAttribute("height")).toBe("40");
    outer.scrollTop = 0;
    expect(await intersecting()).toBe(false);
    outer.scrollTop = 200;
    expect(await intersecting()).toBe(true);
    expect(reads).toBe(1);
  } finally { view.unmount(); releaseAssets(); }
});
