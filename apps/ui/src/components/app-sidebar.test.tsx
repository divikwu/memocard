// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar, type AppSidebarProps } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";

const createProps = (overrides: Partial<AppSidebarProps> = {}): AppSidebarProps => ({
  view: "notes", tag: null, tags: [{ name: "生活", count: 2 }, { name: "工作", count: 1 }],
  draftCount: 3, vaultName: "我的笔记", connected: true, vaultStatusText: "已连接文件夹", hasVaultIssue: false,
  canCreate: true, canChooseVault: true, canCreateVault: true, needsPermission: false, working: false,
  onNavigate: vi.fn(), onNewNote: vi.fn(), onSearch: vi.fn(), onSelectVault: vi.fn(), onActivateVault: vi.fn(), onReauthorize: vi.fn(),
  ...overrides,
});

function renderSidebar(props: AppSidebarProps) {
  return render(<SidebarProvider open onOpenChange={() => {}}><AppSidebar {...props} /></SidebarProvider>);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AppSidebar", () => {
  it("connects note, search, draft and exact tag navigation to the existing handlers", () => {
    const props = createProps({ view: "notes", tag: "工作" });
    renderSidebar(props);
    expect(screen.getByRole("button", { name: "工作" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "所有笔记" }).getAttribute("aria-current")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    expect(props.onNewNote).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    expect(props.onSearch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /^草稿/ }));
    expect(props.onNavigate).toHaveBeenLastCalledWith("drafts");
    fireEvent.click(screen.getByRole("button", { name: "生活" }));
    expect(props.onNavigate).toHaveBeenLastCalledWith("notes", "生活");
    fireEvent.click(screen.getByRole("button", { name: "所有笔记" }));
    expect(props.onNavigate).toHaveBeenLastCalledWith("notes", null);
  });

  it("invokes the directory picker directly in the menu click before yielding user activation", async () => {
    const props = createProps();
    renderSidebar(props);
    await userEvent.click(screen.getByRole("button", { name: "笔记库：我的笔记" }));
    expect(screen.queryByText("⌥1")).toBeNull();
    const open = await screen.findByRole("menuitem", { name: "打开已有笔记库" });
    fireEvent.click(open);
    expect(props.onSelectVault).toHaveBeenCalledExactlyOnceWith(false);
    await userEvent.click(screen.getByRole("button", { name: "笔记库：我的笔记" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "创建新笔记库" }));
    expect(props.onSelectVault).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("menuitem", { name: "重新授权文件夹" })).toBeNull();
  });

  it("lists registered vaults and activates an inactive vault", async () => {
    const props = createProps({
      vaultId: "vault-a",
      registeredVaults: [
        { vaultId: "vault-a", name: "工作", active: true },
        { vaultId: "vault-b", name: "个人", active: false },
      ],
    });
    renderSidebar(props);
    await userEvent.click(screen.getByRole("button", { name: "笔记库：我的笔记" }));
    expect(screen.getByRole("menu").getAttribute("data-align")).toBe("start");
    expect(await screen.findByRole("menuitem", { name: /工作/ })).toBeTruthy();
    expect(screen.getByText("⌥1")).toBeTruthy();
    expect(screen.getByText("⌥2")).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "个人" }));
    expect(props.onActivateVault).toHaveBeenCalledExactlyOnceWith("vault-b");
  });

  it("shows only supported vault actions and offers permission recovery when required", async () => {
    const props = createProps({ canCreate: false, canChooseVault: false, canCreateVault: false, needsPermission: true });
    renderSidebar(props);
    expect((screen.getByRole("button", { name: "新建笔记" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "笔记库：我的笔记" }));
    expect(screen.queryByRole("menuitem", { name: "打开已有笔记库" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "创建新笔记库" })).toBeNull();
    fireEvent.click(await screen.findByRole("menuitem", { name: "重新授权文件夹" }));
    expect(props.onReauthorize).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "笔记库：我的笔记" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "笔记库设置" }));
    expect(props.onNavigate).toHaveBeenCalledWith("settings");
  });

  it("prevents vault changes during an operation and returns keyboard focus after Escape", async () => {
    const props = createProps({ working: true });
    renderSidebar(props);
    const trigger = screen.getByRole("button", { name: "笔记库：我的笔记" });
    const user = userEvent.setup();
    await user.click(trigger);
    expect((await screen.findByRole("menuitem", { name: "打开已有笔记库" })).getAttribute("aria-disabled")).toBe("true");
    expect((await screen.findByRole("menuitem", { name: "创建新笔记库" })).getAttribute("aria-disabled")).toBe("true");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(props.onSelectVault).not.toHaveBeenCalled();
  });

  it("collapses and restores tags without changing the selected filter", async () => {
    const props = createProps({ tag: "生活" });
    renderSidebar(props);
    const trigger = screen.getByRole("button", { name: "标签" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("button", { name: "生活" })).toBeNull());
    await userEvent.click(trigger);
    expect(screen.getByRole("button", { name: "生活" }).getAttribute("aria-current")).toBe("page");
    expect(props.onNavigate).not.toHaveBeenCalled();
  });
});

it("navigates and collapses three-level tags without a directory section", async () => {
  const props = createProps({ tags: [{ name: "工作", count: 2 }, { name: "工作/项目", count: 2 }, { name: "工作/项目/设计", count: 1 }], tag: "工作/项目/设计" });
  renderSidebar(props);
  expect(screen.queryByRole("navigation", { name: "目录" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "工作/项目/设计" }));
  expect(props.onNavigate).toHaveBeenCalledWith("notes", "工作/项目/设计");
  await userEvent.click(screen.getByRole("button", { name: "展开或收起标签 工作/项目" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "工作/项目/设计" })).toBeNull());
  await userEvent.click(screen.getByRole("button", { name: "工作" }));
  expect(props.onNavigate).toHaveBeenLastCalledWith("notes", "工作");
});
