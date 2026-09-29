// @vitest-environment jsdom
import { cleanup, render as renderUI, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { SidebarProvider } from "./ui/sidebar";
import { TagNavigation } from "./tag-navigation";
vi.mock("./tag-emoji-picker", () => ({ default: ({ onSelect }: { onSelect: (emoji: string) => void }) => <button onClick={() => onSelect("🎨")}>选择画板</button> }));
const render = (ui: ReactElement) => renderUI(<SidebarProvider>{ui}</SidebarProvider>);
const props = { vaultId: "vault-a", tags: [{ name: "工作", count: 2 }, { name: "工作/设计", count: 1 }, { name: "生活", count: 1 }], selected: null, onSelect: vi.fn() };
beforeEach(() => { localStorage.clear(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("persists pins per vault and keeps the full tree", async () => {
  const user = userEvent.setup();
  const view = render(<TagNavigation {...props} />);
  await user.click(screen.getByRole("button", { name: "标签操作 工作/设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "置顶标签" }));
  expect(within(screen.getByRole("navigation", { name: "置顶标签" })).getByRole("button", { name: "工作/设计" })).toBeTruthy();
  view.unmount();
  const remount = render(<TagNavigation {...props} />);
  expect(screen.getAllByRole("button", { name: "工作/设计" })).toHaveLength(2);
  remount.unmount();
  render(<TagNavigation {...props} vaultId="vault-b" />);
  expect(screen.queryByRole("navigation", { name: "置顶标签" })).toBeNull();
});
it("searches full paths and saves icons without changing navigation", async () => {
  const user = userEvent.setup();
  render(<TagNavigation {...props} />);
  await user.click(screen.getByRole("button", { name: "搜索标签" }));
  await user.type(screen.getByRole("textbox", { name: "搜索标签" }), "设计");
  expect(screen.queryByRole("button", { name: "生活" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "工作/设计" }));
  expect(props.onSelect).toHaveBeenLastCalledWith("工作/设计");
  await user.click(screen.getByRole("button", { name: "标签操作 工作/设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "标签名称" }));
  expect(screen.getByRole("button", { name: "选择 Emoji" }).textContent).toBe("");
  expect(screen.queryByRole("button", { name: "使用图标 🎨" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "选择 Emoji" }));
  expect(screen.getByRole("button", { name: "清除" }).hasAttribute("disabled")).toBe(true);
  await user.click(await screen.findByRole("button", { name: "选择画板" }));
  expect(screen.getByRole("button", { name: "选择画板" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "清除" }).hasAttribute("disabled")).toBe(false);
  await user.click(screen.getByRole("button", { name: "保存" }));
  expect(screen.queryByLabelText("编辑标签")).toBeNull();
  expect(screen.getByRole("button", { name: "工作/设计" }).textContent).toContain("🎨");
  cleanup();
  render(<TagNavigation {...props} />);
  expect(screen.getByRole("button", { name: "工作/设计" }).textContent).toContain("🎨");
});

it("renames before saving display preferences and discards unsaved edits", async () => {
  const onRename = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<TagNavigation {...props} onRename={onRename} />);
  await user.click(screen.getByRole("button", { name: "标签操作 工作" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  await user.clear(screen.getByRole("textbox", { name: "标签名称" }));
  await user.type(screen.getByRole("textbox", { name: "标签名称" }), "职业");
  await user.click(screen.getByRole("button", { name: "保存" }));
  expect(onRename).toHaveBeenCalledWith("工作", "职业");
});

it("aligns hierarchy controls and stretches nested rows", () => {
  render(<TagNavigation {...props} tags={[...props.tags, { name: "工作/设计/界面", count: 1 }]} />);
  const nestedButton = screen.getByRole("button", { name: "工作/设计" });
  const nestedRow = nestedButton.parentElement;
  const nestedCollapsible = nestedRow?.parentElement;
  const nestedItem = nestedCollapsible?.parentElement;
  const nestedMenu = nestedItem?.parentElement;

  expect(nestedButton.className).toContain("w-full");
  expect(nestedButton.querySelector("span")?.className).toContain("size-4");
  expect(nestedRow?.className).toContain("w-full");
  expect(nestedCollapsible?.className).toContain("w-full");
  expect(nestedItem?.className).toContain("w-full");
  expect(nestedMenu?.className).toContain("mr-0");
  expect(nestedMenu?.className).toContain("pr-0");
  expect(screen.getByRole("button", { name: "展开或收起标签 工作/设计" }).className).toContain("left-1.5");
});
