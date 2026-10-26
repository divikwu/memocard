// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Sidebar, SidebarProvider, SidebarTrigger } from "./sidebar";

const mediaListeners = new Set<() => void>();
beforeEach(() => {
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: window.innerWidth < 768, media: query, addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener), removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener) }));
});
afterEach(() => { cleanup(); mediaListeners.clear(); vi.unstubAllGlobals(); });

it("keeps the provider context available after the sidebar module is re-evaluated", async () => {
  const refreshedModulePath = "./sidebar.tsx?hmr-context-regression";
  const { useSidebar: useRefreshedSidebar } = await import(refreshedModulePath);
  function RefreshedConsumer() {
    return <p>{useRefreshedSidebar().state}</p>;
  }
  const user = userEvent.setup();
  render(<SidebarProvider persistState={false}><SidebarTrigger /><RefreshedConsumer /></SidebarProvider>);
  expect(screen.getByText("expanded")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "收起侧栏" }));
  expect(screen.getByText("collapsed")).not.toBeNull();
});

it("makes collapsed offcanvas content inert and announces the trigger state", async () => {
  const user = userEvent.setup();
  const { container } = render(<SidebarProvider persistState={false}><Sidebar><button>侧栏业务操作</button></Sidebar><SidebarTrigger /></SidebarProvider>);
  const trigger = screen.getByRole("button", { name: "收起侧栏" });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.click(trigger);
  const inner = container.querySelector('[data-slot="sidebar-inner"]')!;
  expect(inner.hasAttribute("inert")).toBe(true);
  expect(inner.getAttribute("aria-hidden")).toBe("true");
  await user.click(screen.getByRole("button", { name: "展开侧栏" }));
  expect(inner.hasAttribute("inert")).toBe(false);
  expect(inner.getAttribute("aria-hidden")).toBe("false");
});

it("leaves bold and editing shortcuts inside editors and dialogs available", () => {
  render(<SidebarProvider persistState={false}><Sidebar><p>导航</p></Sidebar><SidebarTrigger /><input aria-label="编辑标题" /><div contentEditable role="textbox" aria-label="编辑正文" /><section role="dialog" aria-label="业务弹窗"><button>弹窗操作</button></section></SidebarProvider>);
  for (const target of [screen.getByRole("textbox", { name: "编辑标题" }), screen.getByRole("textbox", { name: "编辑正文" }), screen.getByRole("button", { name: "弹窗操作" })]) {
    expect(fireEvent.keyDown(target, { key: "b", ctrlKey: true })).toBe(true);
    expect(screen.getByRole("button", { name: "收起侧栏" }).getAttribute("aria-expanded")).toBe("true");
  }
  expect(fireEvent.keyDown(document.body, { key: "b", ctrlKey: true })).toBe(false);
  expect(screen.getByRole("button", { name: "展开侧栏" }).getAttribute("aria-expanded")).toBe("false");
});

it("keeps the existing 85vw / 360px mobile drawer and closes it across the desktop breakpoint", async () => {
  vi.stubGlobal("innerWidth", 390);
  const change = vi.fn();
  function ControlledSidebar() {
    const [open, setOpen] = useState(true);
    return <SidebarProvider persistState={false} openMobile={open} onOpenMobileChange={next => { change(next); setOpen(next); }}><Sidebar aria-label="业务导航"><button>移动业务</button></Sidebar><SidebarTrigger /></SidebarProvider>;
  }
  render(<ControlledSidebar />);
  const drawer = await screen.findByRole("dialog", { name: "业务导航" });
  expect(drawer.style.width).toBe("85vw");
  expect(drawer.style.maxWidth).toBe("360px");
  act(() => { vi.stubGlobal("innerWidth", 1024); mediaListeners.forEach(listener => listener()); });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(change).toHaveBeenCalledWith(false);
  act(() => { vi.stubGlobal("innerWidth", 390); mediaListeners.forEach(listener => listener()); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "打开导航" }).getAttribute("aria-expanded")).toBe("false");
});
