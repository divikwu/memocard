import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Menu } from "@base-ui/react/menu";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { RichMarkdownEditor } from "../src/RichMarkdownEditor";
import { CalloutColorsMenu } from "../src/CalloutColorsMenu";
import { calloutColors } from "../src/import-layout";
import { colorPixel } from "./foundation-color-contrast";
import { desktopGlobals } from "../.storybook/viewports";

// Independent appearance baselines captured before extracting the tokens.
const lightText = ["#5b5b5b", "#8b5e3c", "#b45309", "#856400", "#15803d", "#1d4ed8", "#7e22ce", "#be185d", "#b91c1c"];
const darkText = ["#a3a3a3", "#d6b49c", "#fdba74", "#fcd34d", "#86efac", "#93c5fd", "#d8b4fe", "#f9a8d4", "#fca5a5"];
const menuColors = ["#737373", "#9a6b4a", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ef4444"];
const labels = ["默认", "灰色", "棕色", "橙色", "黄色", "绿色", "蓝色", "紫色", "粉色", "红色"];
const initial = calloutColors.map(color => `<aside data-callout="${color}" data-callout-icon="🧭"${color === "default" ? "" : ` data-callout-text-color="${color}"`}><h3>${color}</h3><p>标注正文</p></aside>`).join("\n\n");
const noop = () => {};

function CalloutFixture() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  return <main className="space-y-4 bg-background p-6 text-foreground">
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger disabled={!editor}>标注操作</Menu.Trigger>
      <Menu.Portal><Menu.Positioner><Menu.Popup>
        {editor && <CalloutColorsMenu editor={editor} pos={0} onClose={() => setOpen(false)} />}
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
    <RichMarkdownEditor value={value} onChange={setValue} onEditorReady={setEditor} notePath="fixture.md" disabled={false} autoFocus={false} onSave={noop} onError={noop} />
  </main>;
}

const meta = { title: "internal/callout colors", component: CalloutFixture, globals: desktopGlobals, tags: ["!dev", "!autodocs"] } satisfies Meta<typeof CalloutFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement), document = canvasElement.ownerDocument;
    const body = within(document.body);
    const content = await canvas.findByRole("textbox", { name: "笔记内容" });
    await waitFor(() => expect(content.querySelectorAll("aside")).toHaveLength(10));
    const foreground = getComputedStyle(document.documentElement).getPropertyValue("--foreground");
    const text = [foreground, ...(globals.theme === "dark" ? darkText : lightText)];
    for (const [index, aside] of [...content.querySelectorAll("aside")].entries()) {
      await expect(colorPixel(getComputedStyle(aside).color)).toEqual(colorPixel(text[index]));
      await expect(colorPixel(getComputedStyle(aside.querySelector("h3")!).color)).toEqual(colorPixel(text[index]));
    }
    const openMenu = async () => {
      await userEvent.click(canvas.getByRole("button", { name: "标注操作" }));
      const trigger = await body.findByRole("menuitem", { name: /^颜色$/ });
      trigger.focus();
      await userEvent.keyboard("{ArrowRight}");
      return within(await body.findByRole("menu", { name: "标注颜色" }));
    };
    const menu = await openMenu();
    const swatches = [foreground, ...menuColors];
    for (const [index, label] of labels.entries()) for (const kind of ["文字", "背景"]) {
      const swatch = menu.getByRole("menuitemradio", { name: `${label}${kind}` }).querySelector<HTMLElement>(".rich-callout-swatch")!;
      await expect(colorPixel(getComputedStyle(swatch).color)).toEqual(colorPixel(swatches[index]));
      const expected = kind === "文字" || index === 0 ? "--background" : `--callout-background-${calloutColors[index]}`;
      await expect(colorPixel(getComputedStyle(swatch).backgroundColor)).toEqual(colorPixel(getComputedStyle(document.documentElement).getPropertyValue(expected)));
    }
    // Prove both consumers read their roles, rather than retaining the old literals.
    const root = document.documentElement;
    try {
      for (const color of calloutColors.slice(1)) {
        root.style.setProperty(`--callout-text-${color}`, "#123456");
        root.style.setProperty(`--callout-swatch-${color}`, "#654321");
      }
      for (const aside of [...content.querySelectorAll("aside")].slice(1)) {
        await expect(colorPixel(getComputedStyle(aside).color)).toEqual(colorPixel("#123456"));
        await expect(colorPixel(getComputedStyle(aside.querySelector("h3")!).color)).toEqual(colorPixel("#123456"));
      }
      for (const label of labels.slice(1)) for (const kind of ["文字", "背景"]) {
        await expect(colorPixel(getComputedStyle(menu.getByRole("menuitemradio", { name: `${label}${kind}` }).querySelector(".rich-callout-swatch")!).color)).toEqual(colorPixel("#654321"));
      }
      await expect(colorPixel(getComputedStyle(content.querySelector("aside")!).color)).toEqual(colorPixel(foreground));
    } finally {
      for (const color of calloutColors.slice(1)) for (const role of ["text", "swatch"]) root.style.removeProperty(`--callout-${role}-${color}`);
    }
    await userEvent.click(menu.getByRole("menuitemradio", { name: "棕色文字" }));
    const first = content.querySelector("aside")!;
    await waitFor(() => expect(first).toHaveAttribute("data-callout-text-color", "brown"));
    await expect(first).toHaveAttribute("data-callout", "default");
    await expect(body.queryByRole("menu", { name: "标注颜色" })).toBeNull();
    await userEvent.click((await openMenu()).getByRole("menuitemradio", { name: "紫色背景" }));
    await waitFor(() => expect(first).toHaveAttribute("data-callout", "purple"));
    await expect(first).toHaveAttribute("data-callout-text-color", "brown");
    await userEvent.click((await openMenu()).getByRole("menuitemradio", { name: "默认文字" }));
    await waitFor(() => expect(first).not.toHaveAttribute("data-callout-text-color"));
    await expect(colorPixel(getComputedStyle(first).color)).toEqual(colorPixel(foreground));
    await userEvent.click((await openMenu()).getByRole("menuitemradio", { name: "默认背景" }));
    await waitFor(() => expect(first).toHaveAttribute("data-callout", "default"));
    await expect(first).toHaveAttribute("data-callout-icon", "🧭");
    await expect(first).toHaveTextContent("标注正文");
    await expect(getComputedStyle(first).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  },
};
export const Dark: Story = { ...Default, tags: ["!dev", "!autodocs"], globals: { theme: "dark" } };
