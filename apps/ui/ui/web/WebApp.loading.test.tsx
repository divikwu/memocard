// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act, waitFor, within } from "@testing-library/react";
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
    await waitFor(() => expect(host.querySelector("#desktop-sidebar")).not.toBeNull());
    const navigation = host.querySelector("#desktop-sidebar");
    await act(async () => { settings.reject(new TypeError("Failed to fetch dynamically imported module")); });
    await waitFor(() => expect(host.querySelector("#desktop-sidebar")).toBe(navigation));
    expect(uncaught).not.toHaveBeenCalled();
    const alert = await within(host).findByRole("alert");
    expect(alert.textContent).toContain("无法打开设置");

    vi.doMock("./WebSettings", () => ({ WebSettings: () => <h1>设置已恢复</h1> }));
    await userEvent.setup().click(within(alert).getByRole("button", { name: "重试加载设置" }));
    await within(host).findByRole("heading", { name: "设置已恢复" });
    expect(host.querySelector("#desktop-sidebar")).toBe(navigation);
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
