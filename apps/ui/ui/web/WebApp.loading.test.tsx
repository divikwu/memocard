// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act, render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { createWorkspaceFixture } from "./workspace-fixture";
import { resetStorybookBridge, setStorybookRequestHandler } from "../../test-support/bridge";

const settings = vi.hoisted(() => {
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_, fail) => { reject = fail; });
  return { pending, reject };
});
vi.mock("./WebSettings", () => settings.pending);

it("keeps navigation mounted when a feature chunk fails and retries the loader", async () => {
  localStorage.clear();
  history.replaceState(null, "", "#/settings");
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const fixture = await createWorkspaceFixture("loading");
  const detach = setStorybookRequestHandler(fixture.request);
  const host = document.createElement("div");
  document.body.append(host);
  const uncaught = vi.fn();
  const root = createRoot(host, { onUncaughtError: uncaught, onCaughtError: () => {} });
  try {
    await act(async () => { root.render(<App />); });
    const navigation = await within(host).findByRole("navigation", { name: "桌面导航" });
    await act(async () => { settings.reject(new TypeError("Failed to fetch dynamically imported module")); });
    await waitFor(() => expect(within(host).getByRole("navigation", { name: "桌面导航" })).toBe(navigation));
    expect(uncaught).not.toHaveBeenCalled();
    const alert = await within(host).findByRole("alert");
    expect(alert.textContent).toContain("设置页未能打开");

    vi.doMock("./WebSettings", () => ({ WebSettings: () => <h1>设置已恢复</h1> }));
    await userEvent.setup().click(within(alert).getByRole("button", { name: "重新加载设置页" }));
    await within(host).findByRole("heading", { name: "设置已恢复" });
    expect(within(host).getByRole("navigation", { name: "桌面导航" })).toBe(navigation);
    expect(within(host).queryByRole("alert")).toBeNull();
    await act(async () => { root.render(null); });
    await act(async () => { root.render(<App />); });
    await within(host).findByRole("heading", { name: "设置已恢复" });
    expect(within(host).queryByRole("alert")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove(); detach(); resetStorybookBridge(); vi.unstubAllGlobals();
    vi.doUnmock("./WebSettings");
  }
});

it("offers a refresh on home when the old quick capture module is gone", async () => {
  localStorage.clear();
  history.replaceState(null, "", "#/home");
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const entry = await import("./local-web-entry-missing");
  const missing = vi.spyOn(entry, "localWebEntryMissing").mockResolvedValue(true);
  vi.doMock("../business/QuickCapture", () => { throw new TypeError("Failed to fetch dynamically imported module"); });
  const fixture = await createWorkspaceFixture();
  const detach = setStorybookRequestHandler(fixture.request);
  const view = render(<App />);
  try {
    const home = within(view.container);
    await home.findByText("本机服务已更新");
    expect(home.getByRole("button", { name: "刷新页面" })).toBeTruthy();
    expect(home.queryByRole("button", { name: /重试|重新加载快速记录/ })).toBeNull();
    expect(home.getByRole("list", { name: "笔记列表" })).toBeTruthy();
  } finally {
    view.unmount();
    detach(); resetStorybookBridge(); missing.mockRestore(); vi.unstubAllGlobals();
    vi.doUnmock("../business/QuickCapture");
  }
});
