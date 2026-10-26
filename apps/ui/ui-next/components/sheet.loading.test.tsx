// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AppSidebar, type AppSidebarProps } from "../business/sidebar";
import { SidebarProvider } from "./sidebar";

const swipe = vi.hoisted(() => {
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_, fail) => { reject = fail; });
  return { pending, reject };
});
vi.mock("./sheet-swipe", () => swipe.pending);

it("keeps mobile vault content, navigation and closing available when swipe loading fails, then retries", async () => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const props: AppSidebarProps = {view: "notes", tag: null, tags: [], vaultName: "QA", vaultStatusText: "", hasVaultIssue: false,
    canCreate: false, canChooseVault: true, canCreateVault: false, needsPermission: false, working: false,
    onNavigate: vi.fn(), onNewNote: vi.fn(), onSearch: vi.fn(), onSelectVault: vi.fn(), onActivateVault: vi.fn(), onReauthorize: vi.fn()};
  const host = document.createElement("div");
  document.body.append(host);
  const uncaught = vi.fn();
  const root = createRoot(host, {onUncaughtError: uncaught, onCaughtError: () => {}});
  const user = userEvent.setup();
  try {
    await act(async () => { root.render(<SidebarProvider openMobile persistState={false}><AppSidebar {...props} /></SidebarProvider>); });
    const navigation = document.querySelector('nav[aria-label="主要导航"]');
    const trigger = await screen.findByRole("button", {name: "笔记库：QA"});
    await user.click(trigger);
    const popup = await screen.findByRole("dialog", {name: "笔记库"});
    await act(async () => { swipe.reject(new TypeError("Failed to fetch dynamically imported module")); });
    const alert = await within(popup).findByRole("alert");
    expect(alert.textContent).toContain("无法打开滑动关闭");
    expect(document.querySelector('nav[aria-label="主要导航"]')).toBe(navigation);
    expect(within(popup).getByRole("button", {name: "打开已有笔记库"})).toBeTruthy();
    expect(uncaught).not.toHaveBeenCalled();
    await user.click(within(popup).getByRole("button", {name: "关闭笔记库菜单"}));
    await waitFor(() => expect(screen.queryByRole("dialog", {name: "笔记库"})).toBeNull());
    expect(navigation?.isConnected).toBe(true);

    await user.click(trigger);
    const reopened = await screen.findByRole("dialog", {name: "笔记库"});
    vi.doMock("./sheet-swipe", () => vi.importActual("./sheet-swipe"));
    await user.click(await within(reopened).findByRole("button", {name: "重试加载滑动关闭"}));
    await waitFor(() => expect(reopened.hasAttribute("data-swipe-ready")).toBe(true));
    expect(within(reopened).queryByRole("alert")).toBeNull();
    expect(document.querySelector('nav[aria-label="主要导航"]')).toBe(navigation);
    await user.click(within(reopened).getByRole("button", {name: "关闭笔记库菜单"}));
    await waitFor(() => expect(screen.queryByRole("dialog", {name: "笔记库"})).toBeNull());
  } finally {
    await act(async () => root.unmount());
    host.remove(); vi.unstubAllGlobals(); vi.doUnmock("./sheet-swipe");
  }
});
