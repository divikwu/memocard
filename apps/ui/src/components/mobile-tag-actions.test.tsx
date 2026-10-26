// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileTagActions } from "@ui-next/business/MobileTagActions";
import { TagNavigation } from "@ui-next/business/tag-navigation";
import { SidebarProvider } from "@ui-next/components/sidebar";

const props = { tag:"工作/设计", vaultId:"tag-actions-test", onRename:vi.fn() };
beforeEach(() => {
  vi.stubGlobal("innerWidth", 390);
  localStorage.clear(); props.onRename.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("matchMedia", () => ({matches:true,addEventListener() {},removeEventListener() {}}));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shares pin and unpin state with the sidebar and restores title focus", async () => {
  const user = userEvent.setup();
  render(<><SidebarProvider><TagNavigation vaultId={props.vaultId} tags={[{name:"工作",count:1},{name:props.tag,count:1}]} selected={props.tag} onSelect={vi.fn()} /></SidebarProvider><MobileTagActions {...props} /></>);
  const nav = within(screen.getByRole("navigation", {name:"标签"}));
  expect(nav.queryByRole("button", {name:/标签操作/})).toBeNull();
  const trigger = screen.getByRole("button", {name:`标签操作 ${props.tag}`});
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitem", {name:"置顶标签"}));
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(within(screen.getByRole("navigation", {name:"置顶标签"})).getByRole("button", {name:props.tag})).toBeTruthy();
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitem", {name:"取消置顶"}));
  await waitFor(() => expect(screen.queryByRole("navigation", {name:"置顶标签"})).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("edits the name and icon in a sheet and migrates the shared preferences", async () => {
  localStorage.setItem(`memocard:tags:${props.vaultId}`, JSON.stringify({pinned:[props.tag],icons:{}}));
  const user = userEvent.setup(); render(<MobileTagActions {...props} />);
  const trigger = screen.getByRole("button", {name:`标签操作 ${props.tag}`});
  await user.click(trigger);
  await user.click(await screen.findByRole("menuitem", {name:"编辑名称／图标"}));
  const input = await screen.findByRole("textbox", {name:"标签名称"});
  expect(screen.getByRole("dialog", {name:"编辑标签"})).toBeTruthy();
  expect(screen.getByRole("button", {name:"选择 Emoji"}).getAttribute("aria-expanded")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(input));
  await user.clear(input); await user.type(input, "工作/界面");
  await user.type(screen.getByRole("textbox", {name:"搜索 Emoji"}), "🎨");
  await user.click(await screen.findByRole("button", {name:/调色板/}));
  await user.click(screen.getByRole("button", {name:"保存"}));
  await waitFor(() => expect(screen.queryByRole("dialog", {name:"编辑标签"})).toBeNull());
  expect(props.onRename).toHaveBeenCalledWith(props.tag, "工作/界面");
  expect(JSON.parse(localStorage.getItem(`memocard:tags:${props.vaultId}`)!)).toEqual({pinned:["工作/界面"],icons:{"工作/界面":"🎨"}});
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("keeps edited text after a rename failure and can cancel without changing preferences", async () => {
  props.onRename.mockRejectedValue(new Error("重命名失败"));
  const user = userEvent.setup(); render(<MobileTagActions {...props} />);
  const trigger = screen.getByRole("button", {name:`标签操作 ${props.tag}`});
  await user.click(trigger); await user.click(await screen.findByRole("menuitem", {name:"编辑名称／图标"}));
  const input = await screen.findByRole("textbox", {name:"标签名称"});
  await user.clear(input); await user.type(input, "工作/界面");
  await user.click(screen.getByRole("button", {name:"保存"}));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "重命名失败");
  expect(input).toHaveProperty("value", "工作/界面");
  await user.click(screen.getByRole("button", {name:"关闭编辑标签"}));
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(localStorage.getItem(`memocard:tags:${props.vaultId}`)).toBeNull();
});

it("keeps the edit sheet open until a pending rename completes", async () => {
  let complete!: () => void;
  props.onRename.mockImplementation(() => new Promise<void>(resolve => { complete = resolve; }));
  const user = userEvent.setup(); render(<MobileTagActions {...props} />);
  await user.click(screen.getByRole("button", {name:`标签操作 ${props.tag}`}));
  await user.click(await screen.findByRole("menuitem", {name:"编辑名称／图标"}));
  const input = await screen.findByRole("textbox", {name:"标签名称"});
  await user.clear(input); await user.type(input, "工作/界面");
  await user.click(screen.getByRole("button", {name:"保存"}));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog", {name:"编辑标签"})).toBeTruthy();
  expect(screen.getByRole("button", {name:"关闭编辑标签"})).toHaveProperty("disabled", true);
  complete();
  await waitFor(() => expect(screen.queryByRole("dialog", {name:"编辑标签"})).toBeNull());
});

it("keeps the action menu open when pin preferences cannot be saved", async () => {
  const user = userEvent.setup(); render(<MobileTagActions {...props} />);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
  await user.click(screen.getByRole("button", {name:`标签操作 ${props.tag}`}));
  await user.click(await screen.findByRole("menuitem", {name:"置顶标签"}));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "无法保存标签设置，请检查浏览器存储权限。");
  expect(screen.getByRole("menu", {name:`标签操作 ${props.tag}`})).toBeTruthy();
});

it.each(["所有笔记", "有图片"])("offers saved layout choices without tag actions on %s", async title => {
  localStorage.setItem("memocard:note-layout", "list");
  const user = userEvent.setup();
  render(<MobileTagActions title={title} onRename={props.onRename} />);
  const trigger = screen.getByRole("button", {name:`视图选项 ${title}`});
  await user.click(trigger);
  expect((await screen.findByRole("menuitemradio", {name:"列表"})).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("menuitem", {name:"置顶标签"})).toBeNull();
  expect(screen.queryByRole("separator")).toBeNull();
  await user.click(screen.getByRole("menuitemradio", {name:"卡片"}));
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(localStorage.getItem("memocard:note-layout")).toBe("cards");
  await user.click(trigger);
  expect((await screen.findByRole("menuitemradio", {name:"卡片"})).getAttribute("aria-checked")).toBe("true");
});

it("separates layout choices from tag actions", async () => {
  render(<MobileTagActions {...props} />);
  await userEvent.setup().click(screen.getByRole("button", {name:`标签操作 ${props.tag}`}));
  expect(await screen.findAllByRole("menuitemradio")).toHaveLength(2);
  expect(screen.getByRole("separator")).toBeTruthy();
  expect(screen.getByRole("menuitem", {name:"编辑名称／图标"})).toBeTruthy();
});
