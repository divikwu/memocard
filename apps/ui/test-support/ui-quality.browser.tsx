import { afterEach, expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { ComponentDocs } from "../ui/ComponentDocs";
import { componentDocs, type ComponentKey } from "../ui/component-docs.data";
import { Button } from "../ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/components/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/components/dialog";
import { NoteProperties } from "../ui/business/NoteProperties";
import { PreviewModeProvider } from "../ui/preview-mode";
import { loadPreviewFonts } from "../ui/preview-fonts";
import { useNoteImage } from "../src/use-note-image";
import { setStorybookBrowserAssets, setStorybookRequestHandler } from "./bridge";
import { editorNote } from "./editor-note";
import "../.storybook/preview.css";
import "../ui/preview-appearance.css";

afterEach(async () => {
  cleanup();
  await commands.setReducedMotion("no-preference");
  await commands.setFontsOffline(false);
  document.documentElement.removeAttribute("data-ui-appearance");
  document.documentElement.removeAttribute("data-ui-theme");
  document.documentElement.removeAttribute("style");
});

for (const width of [320, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`property editing and confirmation surfaces stay consistent at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    const changes: unknown[] = [];
    const release = setStorybookRequestHandler(operation => {
      if (operation === "getPropertyLabels") return { labels: {}, contentHash: "labels" };
      if (operation === "listTags") return { tags: [{ name: "开发" }] };
      throw new Error(`Unexpected property operation: ${operation}`);
    });
    const view = render(<PreviewModeProvider mode={theme}><main className="ui-theme" data-ui-theme={theme}>
      <div data-testid="floating-reference" className="surface-floating border" />
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async change => { changes.push(change); }} onChangeTag={async (from, to) => { changes.push({ from, to }); }} savedProperties={{
        contentHash: editorNote.contentHash, writable: true,
        tagProperty: { name: "tags", type: "list", value: ["设计"], editable: true },
        properties: [
          { name: "摘要", type: "text", value: "保留原值", editable: true },
          { name: "得分", type: "number", value: "8.5", editable: true },
          { name: "领域", type: "multiSelect", value: ["设计"], options: [{ name: "设计", color: "blue" }], editable: true },
        ],
      }} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container), body = within(document.body);
    try {
      await userEvent.click(await canvas.findByRole("button", { name: /^属性$/ }));
      for (const name of ["摘要", "得分"]) {
        await userEvent.click(canvas.getByRole("button", { name: `编辑属性 ${name}` }));
        const input = await body.findByRole("textbox", { name: "属性值" });
        const style = getComputedStyle(input.closest("form")!);
        expect(style.boxShadow).toBe("none");
        expect(style.outlineStyle).toBe("solid");
        await userEvent.keyboard("{Escape}");
      }
      const checkConfirmation = async () => {
        const popup = await body.findByRole("alertdialog");
        const reference = getComputedStyle(canvas.getByTestId("floating-reference"));
        await waitFor(() => {
          const style = getComputedStyle(popup), rect = popup.getBoundingClientRect();
          expect(style.boxShadow).toBe(reference.boxShadow);
          expect(style.borderTopColor).toBe(reference.borderTopColor);
          expect(style.borderTopWidth).toBe("1px");
          expect(rect.left).toBeGreaterThanOrEqual(-1);
          expect(rect.right).toBeLessThanOrEqual(width + 1);
          if (width < 768) expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThan(1);
        });
        if (width < 768) expect(popup.dataset.side).toBe("bottom");
        await userEvent.click(within(popup).getByRole("button", { name: "取消" }));
        await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
      };
      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      await userEvent.click(await body.findByRole("menuitem", { name: "删除属性" }));
      await checkConfirmation();
      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      const types = await body.findByRole("menuitem", { name: /^类型/ });
      await userEvent.click(types);
      await userEvent.click(await body.findByRole("menuitemradio", { name: "多选" }));
      await checkConfirmation();
      for (const kind of ["选项", "标签"]) {
        await userEvent.click(canvas.getByRole("button", { name: kind === "选项" ? "编辑属性 领域" : "编辑标签" }));
        await userEvent.click(await body.findByRole("button", { name: `管理${kind} ${kind === "选项" ? "设计" : "开发"}` }));
        await userEvent.click(await body.findByRole("menuitem", { name: `删除${kind}` }));
        await checkConfirmation();
        await userEvent.keyboard("{Escape}");
        await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
      }
      expect(changes).toEqual([]);
    } finally {
      release();
    }
  }, 20_000);

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

for (const parentTheme of ["light", "dark"] as const) {
  test(`Dialog overlay follows the local theme on a ${parentTheme} page`, async () => {
    for (const theme of ["light", "dark"] as const) {
      const view = render(<PreviewModeProvider mode={parentTheme}><Dialog><DialogTrigger render={<Button />}>打开局部主题</DialogTrigger>
        <DialogContent className="ui-theme" data-ui-theme={theme}><DialogHeader><DialogTitle>局部主题</DialogTitle><DialogDescription>遮罩与弹窗共用主题。</DialogDescription></DialogHeader></DialogContent>
      </Dialog></PreviewModeProvider>);
      await userEvent.click(within(view.container).getByRole("button", { name: "打开局部主题" }));
      const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;
      expect(overlay.dataset.uiTheme).toBe(theme);
      expect(getComputedStyle(overlay).backgroundColor).toContain(theme === "dark" ? "0.8" : "0.5");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull());
      view.unmount();
    }
  });
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
  expect(link.getAttribute("href")).toContain("ui-input--example");
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
