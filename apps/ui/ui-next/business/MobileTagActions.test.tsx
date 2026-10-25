// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileTagActions } from "./MobileTagActions";
import { swipeSheet } from "../../src/components/ui/sheet-swipe.test-utils";

const vaultId = "ui-next-mobile-tag-actions-test";
const key = `memocard:tags:${vaultId}`;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  localStorage.clear();
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it("keeps the header layout menu in sync with the existing home and note preference keys", async () => {
  const user = userEvent.setup();
  const view = render(<MobileTagActions title="主页" home onRename={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "视图选项 主页" }));
  expect((await screen.findByRole("menuitemradio", { name: "卡片" })).getAttribute("aria-checked")).toBe("true");
  await user.click(await screen.findByRole("menuitemradio", { name: "列表" }));
  expect(localStorage.getItem("memocard:home-layout")).toBe("list");
  view.rerender(<MobileTagActions title="所有笔记" onRename={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "视图选项 所有笔记" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "卡片" }));
  expect(localStorage.getItem("memocard:note-layout")).toBe("cards");
  expect(localStorage.getItem("memocard:home-layout")).toBe("list");
});

it("pins from the H5 header, edits name and icon through the sheet, and restores trigger focus", async () => {
  const user = userEvent.setup();
  const rename = vi.fn();
  function Header() {
    const [tag, setTag] = useState("项目/设计");
    return <MobileTagActions tag={tag} vaultId={vaultId} onRename={async (from, to) => { rename(from, to); setTag(to); }} />;
  }
  render(<Header />);
  await user.click(screen.getByRole("button", { name: "标签操作 项目/设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "置顶标签" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(JSON.parse(localStorage.getItem(key) || "{}").pinned).toEqual(["项目/设计"]);
  await user.click(screen.getByRole("button", { name: "标签操作 项目/设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称／图标" }));
  // The first edit loads the shared tag editor and Emoji data through Suspense.
  const sheet = await screen.findByRole("dialog", { name: "编辑标签" }, { timeout: 5000 });
  expect(sheet.getAttribute("data-side")).toBe("bottom");
  fireEvent.change(within(sheet).getByRole("textbox", { name: "标签名称" }), { target: { value: "项目/系统" } });
  const search = within(sheet).getByRole("textbox", { name: "搜索 Emoji" });
  await user.type(search, "🧑🏽‍💻{Enter}");
  expect(screen.getByRole("dialog", { name: "编辑标签" })).toBe(sheet);
  await user.click(within(sheet).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(rename).toHaveBeenCalledWith("项目/设计", "项目/系统");
  const saved = JSON.parse(localStorage.getItem(key) || "{}");
  expect(saved.pinned).toEqual(["项目/系统"]);
  expect(saved.icons["项目/系统"]).toBe("🧑🏽‍💻");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "标签操作 项目/系统" })));
});

it("keeps a failed pin menu open with its error and allows retry without changing the selected tag", async () => {
  const user = userEvent.setup();
  render(<MobileTagActions tag="设计" vaultId={vaultId} onRename={vi.fn()} />);
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  await user.click(screen.getByRole("button", { name: "标签操作 设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "置顶标签" }));
  expect((await screen.findByRole("alert")).textContent).toContain("无法保存标签设置");
  expect(screen.getByRole("menu")).not.toBeNull();
  write.mockRestore();
  await user.click(await screen.findByRole("menuitem", { name: "置顶标签" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(JSON.parse(localStorage.getItem(key) || "{}").pinned).toEqual(["设计"]);
});

it("restores the H5 edit header close and swipe dismissal, returning focus to the title", async () => {
  const user = userEvent.setup();
  render(<MobileTagActions tag="设计" vaultId={vaultId} onRename={vi.fn()} />);
  const trigger = screen.getByRole("button", { name: "标签操作 设计" });
  const open = async () => {
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "编辑名称／图标" }));
    const sheet = await screen.findByRole("dialog", { name: "编辑标签" }, { timeout: 5000 });
    await waitFor(() => expect(sheet.hasAttribute("data-swipe-ready")).toBe(true));
    return sheet;
  };
  await open();
  await user.click(screen.getByRole("button", { name: "关闭编辑标签" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  const sheet = await open();
  swipeSheet(sheet.querySelector('[data-slot="sheet-handle"]')!, 160);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("protects a pending H5 rename from header close, swipe and Escape", async () => {
  const user = userEvent.setup();
  let complete!: () => void;
  const rename = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  render(<MobileTagActions tag="设计" vaultId={vaultId} onRename={rename} />);
  const trigger = screen.getByRole("button", { name: "标签操作 设计" });
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称／图标" }));
  const sheet = await screen.findByRole("dialog", { name: "编辑标签" }, { timeout: 5000 });
  await waitFor(() => expect(sheet.hasAttribute("data-swipe-ready")).toBe(true));
  fireEvent.change(within(sheet).getByRole("textbox", { name: "标签名称" }), { target: { value: "界面" } });
  await user.click(within(sheet).getByRole("button", { name: "保存" }));
  const close = within(sheet).getByRole("button", { name: "关闭编辑标签" });
  expect((close as HTMLButtonElement).disabled).toBe(true);
  await user.click(close);
  swipeSheet(within(sheet).getByRole("heading", { name: "编辑标签" }), 160);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog", { name: "编辑标签" })).toBe(sheet);
  expect(sheet.hasAttribute("data-sheet-dragging")).toBe(false);
  complete();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(rename).toHaveBeenCalledWith("设计", "界面");
});
