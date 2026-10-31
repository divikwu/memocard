// @vitest-environment jsdom
import { cleanup, render as renderUI, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { SidebarProvider } from "@ui/components/sidebar";
import { TagNavigation } from "@ui/business/tag-navigation";
import { TagColorProvider } from "@/TagColorProvider";
import TagColorStyles from "@ui/business/TagColorStyles";
import { setTagColor } from "@/tag-colors";
const render = (ui: ReactElement) => renderUI(<SidebarProvider>{ui}</SidebarProvider>);
const props = { vaultId: "vault-a", tags: [{ name: "工作", count: 2 }, { name: "工作/设计", count: 1 }, { name: "生活", count: 1 }], selected: null, onSelect: vi.fn() };
beforeEach(() => { localStorage.clear(); vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("keeps palettes available per vault without coloring sidebar tags", async () => {
  setTagColor("vault-a", "工作/设计", "green");
  setTagColor("vault-b", "工作/设计", "red");
  const ui = (vaultId: string) => <TagColorProvider vaultId={vaultId}><TagColorStyles /><TagNavigation {...props} vaultId={vaultId} /></TagColorProvider>;
  const view = render(ui("vault-a"));
  await waitFor(() => expect(document.querySelector("style[data-tag-colors]")?.textContent).toContain("--tag-green-bg"));
  expect(screen.getByRole("button", { name: "工作/设计" }).hasAttribute("data-tag")).toBe(false);
  view.rerender(<SidebarProvider>{ui("vault-b")}</SidebarProvider>);
  await waitFor(() => expect(document.querySelector("style[data-tag-colors]")?.textContent).toContain("--tag-red-bg"));
  expect(document.querySelector("style[data-tag-colors]")?.textContent).not.toContain("--tag-green-bg");
});
it('reuses uppercase legacy pins and icons for lowercase tag paths', () => {
  localStorage.setItem('memocard:tags:vault-a',JSON.stringify({pinned:['Work','WORK'],icons:{Work:'🎨'}}));
  render(<TagNavigation {...props} tags={[{name:'work',count:2}]} />);
  const pinned = within(screen.getByRole('navigation',{name:'置顶标签'}));
  expect(pinned.getAllByRole('button',{name:'work'})).toHaveLength(1);
  expect(pinned.getByRole('button',{name:'work'}).textContent).toContain('🎨');
});
it("persists pins per vault and allows expanding and selecting descendants of a pinned nested tag", async () => {
  const user = userEvent.setup();
  const hierarchy = { ...props, tags: [...props.tags, { name: "工作/设计/界面", count: 1 }], selected: "工作/设计/界面" };
  const view = render(<TagNavigation {...hierarchy} />);
  await user.click(screen.getByRole("button", { name: "标签操作 工作/设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "置顶标签" }));
  const pinned = within(screen.getByRole("navigation", { name: "置顶标签" }));
  expect(pinned.getByRole("button", { name: "工作/设计" }).textContent).toContain("工作/设计");
  const child = pinned.getByRole("button", { name: "工作/设计/界面" });
  expect(child.getAttribute("aria-current")).toBe("page");
  await user.click(child);
  expect(props.onSelect).toHaveBeenLastCalledWith("工作/设计/界面");
  const toggle = pinned.getByRole("button", { name: "展开或收起标签 工作/设计" });
  await user.click(toggle);
  await waitFor(() => expect(pinned.queryByRole("button", { name: "工作/设计/界面" })).toBeNull());
  expect(within(screen.getByRole("navigation", { name: "标签" })).getByRole("button", { name: "工作/设计/界面" })).toBeTruthy();
  await user.click(toggle);
  expect(pinned.getByRole("button", { name: "工作/设计/界面" })).toBeTruthy();
  const pinnedToggle = screen.getByRole("button", { name: "置顶标签" });
  expect(pinnedToggle.getAttribute("aria-expanded")).toBe("true");
  await user.click(pinnedToggle);
  await waitFor(() => expect(screen.queryByRole("navigation", { name: "置顶标签" })).toBeNull());
  expect(within(screen.getByRole("navigation", { name: "标签" })).getByRole("button", { name: "工作/设计/界面" }).getAttribute("aria-current")).toBe("page");
  pinnedToggle.focus();
  await user.keyboard("{Enter}");
  expect(within(screen.getByRole("navigation", { name: "置顶标签" })).getByRole("button", { name: "工作/设计/界面" }).getAttribute("aria-current")).toBe("page");
  view.unmount();
  const remount = render(<TagNavigation {...hierarchy} />);
  expect(screen.getAllByRole("button", { name: "工作/设计" })).toHaveLength(2);
  expect(within(screen.getByRole("navigation", { name: "置顶标签" })).getByRole("button", { name: "工作/设计/界面" })).toBeTruthy();
  remount.unmount();
  render(<TagNavigation {...props} vaultId="vault-b" />);
  expect(screen.queryByRole("navigation", { name: "置顶标签" })).toBeNull();
});
it("selects nested tags and saves icons without a tag search control", async () => {
  const user = userEvent.setup();
  render(<TagNavigation {...props} />);
  expect(screen.queryByRole("button", { name: "搜索标签" })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "搜索标签" })).toBeNull();
  expect(screen.getByRole("button", { name: "生活" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "工作/设计" }));
  expect(props.onSelect).toHaveBeenLastCalledWith("工作/设计");
  await user.click(screen.getByRole("button", { name: "标签操作 工作/设计" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "标签名称" })));
  expect(screen.getByRole("button", { name: "选择 Emoji" }).textContent).toBe("");
  expect(screen.queryByRole("button", { name: "使用图标 🎨" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "选择 Emoji" }));
  expect(screen.getByRole("region", { name: "选择图标" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "清除图标" }).hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByRole("textbox", { name: "搜索 Emoji" }), "🎨");
  await user.click(await screen.findByRole("button", { name: /调色板/ }));
  expect(screen.getByRole("button", { name: "选择 Emoji" }).textContent).toBe("🎨");
  expect(screen.getByRole("button", { name: "清除图标" }).hasAttribute("disabled")).toBe(false);
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

it("keeps expanding a nested branch separate from selecting its tag", async () => {
  const user = userEvent.setup(), onSelect = vi.fn();
  render(<TagNavigation {...props} onSelect={onSelect} tags={[...props.tags, { name: "工作/设计/界面", count: 1 }]} />);
  const toggle = screen.getByRole("button", { name: "展开或收起标签 工作/设计" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  await user.click(toggle);
  await waitFor(() => expect(screen.queryByRole("button", { name: "工作/设计/界面" })).toBeNull());
  expect(onSelect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "工作/设计" }));
  expect(onSelect).toHaveBeenCalledWith("工作/设计");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it("keeps source order and leaves missing-parent descendants selectable through pins", async () => {
  const tags = [
    { name: "zebra", count: 4 },
    { name: "zebra/second", count: 2 },
    { name: "missing/child", count: 7 },
    { name: "alpha", count: 1 },
    { name: "zebra/first", count: 3 },
    { name: "missing/child/deeper", count: 5 },
  ];
  localStorage.setItem("memocard:tags:vault-a", JSON.stringify({ pinned: ["missing/child", "zebra/first", "stale"] }));
  render(<TagNavigation {...props} tags={tags} selected="zebra/first" />);
  const navigation = within(screen.getByRole("navigation", { name: "标签" }));
  const paths = new Set(tags.map(tag => tag.name));
  expect(navigation.getAllByRole("button").map(button => button.getAttribute("aria-label")).filter(label => paths.has(label || ""))).toEqual(["zebra", "zebra/second", "zebra/first", "alpha"]);
  expect(navigation.queryByRole("button", { name: "missing/child" })).toBeNull();
  const pinned = within(screen.getByRole("navigation", { name: "置顶标签" }));
  expect(pinned.getAllByRole("button").map(button => button.getAttribute("aria-label")).filter(label => paths.has(label || ""))).toEqual(["missing/child", "missing/child/deeper", "zebra/first"]);
  expect(pinned.getByRole("button", { name: "missing/child" }).textContent).toContain("missing/child");
  expect(pinned.getByRole("button", { name: "zebra/first" }).getAttribute("aria-current")).toBe("page");
  const user = userEvent.setup();
  await user.click(pinned.getByRole("button", { name: "missing/child/deeper" }));
  expect(props.onSelect).toHaveBeenLastCalledWith("missing/child/deeper");
});

it("preserves an independently collapsed branch when tags and the selected path update", async () => {
  const user = userEvent.setup();
  const view = render(<TagNavigation {...props} />);
  const toggle = screen.getByRole("button", { name: "展开或收起标签 工作" });
  await user.click(toggle);
  await waitFor(() => expect(screen.queryByRole("button", { name: "工作/设计" })).toBeNull());
  const tags = [...props.tags, { name: "工作/新增", count: 3 }];
  view.rerender(<SidebarProvider><TagNavigation {...props} tags={tags} selected="工作/新增" /></SidebarProvider>);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "工作/新增" })).toBeNull();
  await user.click(toggle);
  expect(screen.getByRole("button", { name: "工作/新增" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("button", { name: "工作/新增" }).parentElement?.textContent).toContain("3");
});

it("reads the tag collection linearly and reuses the index when only selection changes", () => {
  let reads = 0;
  const tags = new Proxy(Array.from({ length: 80 }, (_, index) => ({ name: `tag-${index}`, count: index })), {
    get(target, key, receiver) {
      if (typeof key === "string" && /^\d+$/.test(key)) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  const view = render(<TagNavigation {...props} tags={tags} />);
  expect(reads).toBeLessThanOrEqual(tags.length * 3);
  const afterMount = reads;
  view.rerender(<SidebarProvider><TagNavigation {...props} tags={tags} selected="tag-1" /></SidebarProvider>);
  expect(screen.getByRole("button", { name: "tag-1" }).getAttribute("aria-current")).toBe("page");
  expect(reads).toBe(afterMount);
});

it("keeps pin menu actions correct with a large saved pin list", async () => {
  const pinned = Array.from({ length: 1024 }, (_, index) => `pin-${index}`);
  localStorage.setItem("memocard:tags:vault-a", JSON.stringify({ pinned }));
  render(<TagNavigation {...props} tags={[{ name: "pin-1023", count: 1 }, { name: "unpinned", count: 2 }]} />);
  const user = userEvent.setup();
  await user.click(within(screen.getByRole("navigation", { name: "标签" })).getByRole("button", { name: "标签操作 pin-1023" }));
  expect(await screen.findByRole("menuitem", { name: "取消置顶" })).toBeTruthy();
  await user.click(screen.getByRole("menuitem", { name: "取消置顶" }));
  expect(screen.queryByRole("navigation", { name: "置顶标签" })).toBeNull();
  expect(JSON.parse(localStorage.getItem("memocard:tags:vault-a") || "{}").pinned).not.toContain("pin-1023");
  await user.click(screen.getByRole("button", { name: "标签操作 unpinned" }));
  expect(await screen.findByRole("menuitem", { name: "置顶标签" })).toBeTruthy();
});

it("uses the latest selection callback when unchanged branches are reused", async () => {
  const user = userEvent.setup();
  const previous = vi.fn(), latest = vi.fn();
  const view = render(<TagNavigation {...props} onSelect={previous} />);
  const tag = screen.getByRole("button", {name: "工作"});
  await user.click(tag);
  expect(previous).toHaveBeenCalledTimes(1);
  view.rerender(<SidebarProvider><TagNavigation {...props} onSelect={latest} /></SidebarProvider>);
  await user.click(tag);
  expect(latest).toHaveBeenCalledWith("工作");
  expect(previous).toHaveBeenCalledTimes(1);
});
