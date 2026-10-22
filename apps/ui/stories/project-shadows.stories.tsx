import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { setStorybookRequestHandler } from "../.storybook/bridge";
import { LoadingCapture, LoadingCollectionItems } from "../src/components/loading-states";
import { QuickCapture, type QuickCaptureHandle } from "../src/components/quick-capture";
import { Button } from "../src/components/ui/button";
import { captureVaultBinding, captureVaultId, createCaptureFixture } from "./quick-capture-fixture";
import "../src/components/app-sidebar.css";

const noop = () => {};
function ShadowFixture() {
  const inline = useRef<QuickCaptureHandle | null>(null);
  const docked = useRef<QuickCaptureHandle | null>(null);
  const props = { vaultId: captureVaultId, vaultBinding: captureVaultBinding, rootNotes: false, tags: [], disabled: false, canImage: false, onRecorded: noop };
  return <main className="space-y-4 p-4">
    <header><Button size="icon" aria-label="导航阴影">☰</Button></header>
    <QuickCapture {...props} handle={inline} />
    <LoadingCapture />
    <LoadingCollectionItems cards />
    <div className="mobile-record-bar">
      <Button aria-label="搜索全部笔记">搜索</Button>
      <QuickCapture {...props} handle={docked} docked onContinue={noop} />
    </div>
  </main>;
}

const meta = {
  title: "internal/project shadows", component: ShadowFixture,
  tags: ["!dev", "!autodocs", "mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  beforeEach: () => setStorybookRequestHandler(createCaptureFixture().request),
} satisfies Meta<typeof ShadowFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

// Independent literals from the production styles before token extraction.
const surface = "0 4px 12px rgba(25,25,25,0.027), 0 1px 2px rgba(25,25,25,0.02)";
const control = "0 2px 8px rgb(0 0 0 / 4%)";

export const Default: Story = {
  play: async ({ canvasElement, globals }) => {
    const document = canvasElement.ownerDocument, canvas = within(canvasElement), body = within(document.body);
    const dark = globals.theme === "dark";
    const focus = dark ? "0 6px 20px rgb(0 0 0 / 28%), 0 1px 3px rgb(0 0 0 / 18%)" : "0 6px 20px rgb(25 25 25 / 6%), 0 1px 3px rgb(25 25 25 / 3%)";
    const floating = dark ? "0 4px 16px rgb(0 0 0 / 24%), 0 1px 3px rgb(0 0 0 / 16%)" : "0 4px 16px rgb(0 0 0 / 6%), 0 1px 3px rgb(0 0 0 / 4%)";
    const check = async (element: Element, value: string) => {
      const probe = document.createElement("span");
      probe.style.boxShadow = value;
      document.body.append(probe);
      const expected = getComputedStyle(probe).boxShadow;
      probe.remove();
      // Tailwind composes empty ring/inset layers ahead of the visible shadow.
      await waitFor(() => expect(getComputedStyle(element).boxShadow.replace(/^(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px, )+/, "")).toBe(expected));
    };
    const group = canvasElement.querySelector(".quick-capture-group")!;
    const loading = canvas.getByRole("status", { name: "正在准备快速输入" }).querySelector('[aria-hidden="true"]')!;
    const cards = [...canvasElement.querySelectorAll('[data-slot="collection-skeleton"] [data-slot="card"]')];
    await expect(cards).toHaveLength(6);
    for (const element of [group, loading, ...cards]) await check(element, surface);
    await check(canvas.getByRole("button", { name: "导航阴影" }), control);
    for (const name of ["搜索全部笔记", "打开快速记录"]) await check(canvas.getByRole("button", { name }), floating);
    const input = canvas.getByRole("textbox", { name: "快速输入内容" });
    await userEvent.click(input);
    await check(group, focus);
    await userEvent.click(loading);
    await userEvent.click(canvas.getByRole("button", { name: "打开快速记录" }));
    const sheet = await body.findByRole("dialog", { name: "快速记录" });
    await check(sheet.querySelector(".quick-capture-group")!, focus);
    await check(within(sheet).getByRole("button", { name: "切换为页面" }), control);
    await check(within(sheet).getByRole("button", { name: "收起快速记录" }), control);
    await userEvent.click(within(sheet).getByRole("button", { name: "收起快速记录" }));
    await waitFor(() => expect(sheet).not.toBeInTheDocument());
    await check(group, surface);
    // Changing each role must reach every affected consumer, including the portal.
    const root = document.documentElement;
    const sentinel = "0 7px 13px rgb(18 52 86 / 70%)";
    const names = ["--surface-shadow", "--surface-focus-shadow", "--control-shadow", "--floating-control-shadow"];
    try {
      for (const name of names) root.style.setProperty(name, sentinel);
      for (const element of [group, loading, ...cards, canvas.getByRole("button", { name: "导航阴影" }), canvas.getByRole("button", { name: "搜索全部笔记" }), canvas.getByRole("button", { name: "打开快速记录" })]) await check(element, sentinel);
      await userEvent.click(input);
      await check(group, sentinel);
      await userEvent.click(loading);
      await userEvent.click(canvas.getByRole("button", { name: "打开快速记录" }));
      const reopened = await body.findByRole("dialog", { name: "快速记录" });
      await check(reopened.querySelector(".quick-capture-group")!, sentinel);
      await check(within(reopened).getByRole("button", { name: "切换为页面" }), sentinel);
      await check(within(reopened).getByRole("button", { name: "收起快速记录" }), sentinel);
      await userEvent.click(within(reopened).getByRole("button", { name: "收起快速记录" }));
      await waitFor(() => expect(reopened).not.toBeInTheDocument());
    } finally {
      for (const name of names) root.style.removeProperty(name);
    }
    await check(group, surface);
  },
};
export const Dark: Story = { ...Default, globals: { theme: "dark" } };
