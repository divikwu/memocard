// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { AppViewState } from "../../src/App";
import { resetStorybookBridge } from "../../test-support/bridge";
import { WebSettings } from "./WebSettings";
import { TooltipHints } from "../components/tooltip";

afterEach(() => { cleanup(); resetStorybookBridge(); });

function state() {
  return {
    status: { connected: true, vaultName: "工作/个人/".repeat(20), coverage: { indexed: 0, pending: 3, issues: 2, indexedAt: "2026-10-23T08:30:00Z" } },
    sidebar: { canChooseVault: true, canCreateVault: true, onSelectVault: vi.fn() },
    drafts: { records: [] }, search: { available: false, open: false },
    capabilities: new Set<string>(), environment: null, working: false, editor: null, unsupportedBrowser: false,
    onOpenLocalWeb: vi.fn(), onToggleMCP: vi.fn(),
  } as unknown as AppViewState;
}

it("keeps file count units, zero values, full vault names and the same index timestamp in the expandable status", async () => {
  const user = userEvent.setup();
  const model = state();
  const view = render(<TooltipHints><WebSettings state={model} /></TooltipHints>);
  const vaultName = screen.getByText(model.status!.vaultName!);
  Object.defineProperties(vaultName, { clientWidth: { value: 160 }, scrollWidth: { value: 1600 } });
  expect(vaultName.hasAttribute("title")).toBe(false);
  await user.hover(vaultName);
  expect((await screen.findByRole("tooltip")).textContent).toBe(model.status!.vaultName);
  await user.unhover(vaultName);
  const summary = screen.getByText("本机文件状态");
  const details = summary.closest("details")!;
  expect(details.open).toBe(false);
  await user.click(summary);
  expect(details.open).toBe(true);
  for (const [name, value] of [["已索引笔记", "0"], ["待读取文件", "3"], ["需要处理的文件", "2"]]) {
    expect(screen.getByText(name).nextElementSibling?.textContent).toBe(value);
  }
  expect(details.querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-23T08:30:00Z");
  summary.focus();
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "恢复默认风格" }));
  model.status!.coverage.indexedAt = "invalid";
  view.rerender(<TooltipHints><WebSettings state={model} /></TooltipHints>);
  expect(within(details).getByText("时间未知")).toBeTruthy();
  model.status!.coverage.indexedAt = null;
  view.rerender(<TooltipHints><WebSettings state={model} /></TooltipHints>);
  expect(within(details).getByText("—")).toBeTruthy();
});

it("keeps native vault buttons and their busy, editor and unsupported-browser guards", async () => {
  const user = userEvent.setup();
  const model = { ...state(), nativeChrome: {} as NonNullable<AppViewState["nativeChrome"]> };
  const view = render(<WebSettings state={model} />);
  await user.click(screen.getByRole("button", { name: "切换笔记库" }));
  await user.click(screen.getByRole("button", { name: "新建笔记库" }));
  expect(model.sidebar.onSelectVault).toHaveBeenNthCalledWith(1, false);
  expect(model.sidebar.onSelectVault).toHaveBeenNthCalledWith(2, true);
  for (const patch of [{ working: true }, { editor: {} as AppViewState["editor"] }]) {
    view.rerender(<WebSettings state={{ ...model, ...patch }} />);
    expect((screen.getByRole("button", { name: "切换笔记库" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "新建笔记库" }) as HTMLButtonElement).disabled).toBe(true);
  }
  view.rerender(<WebSettings state={{ ...model, unsupportedBrowser: true }} />);
  expect(screen.queryByRole("button", { name: "切换笔记库" })).toBeNull();
  expect(screen.queryByRole("button", { name: "新建笔记库" })).toBeNull();
});

it.each([false, true])("opens Web vault actions with the default label (mobile=%s)", async (isMobile) => {
  const user = userEvent.setup();
  const model = { ...state(), isMobile };
  const view = render(<WebSettings state={model} />);
  const trigger = screen.getByRole("button", { name: "笔记库操作（切换）" });
  expect(trigger.textContent).toBe("切换");
  for (const action of ["打开已有笔记库", "创建新笔记库"]) {
    await user.click(trigger);
    const panel = await screen.findByRole("dialog", { name: "切换笔记库" });
    await user.click(within(panel).getByRole("button", { name: action }));
    expect(trigger.textContent).toBe("切换");
  }
  expect(model.sidebar.onSelectVault).toHaveBeenNthCalledWith(1, false);
  expect(model.sidebar.onSelectVault).toHaveBeenNthCalledWith(2, true);
  view.rerender(<WebSettings state={{ ...model, working: true }} />);
  expect((trigger as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<WebSettings state={{ ...model, status: null }} />);
  expect(screen.getByRole("button", { name: "笔记库操作（打开）" }).textContent).toBe("打开");
});

it("keeps Mac MCP scope and the updating status while guarding actions during a pending update", async () => {
  const user = userEvent.setup();
  const model = state();
  model.capabilities = new Set(["openWeb", "setMCPEnabled"]);
  model.environment = { platform: "mac", mcpEnabled: true, mcpWritesEnabled: false } as AppViewState["environment"];
  const view = render(<WebSettings state={model} />);
  expect(screen.getByText("保持主客户端运行。可新建、修改、移入回收站和恢复笔记，不开放永久删除。")).toBeTruthy();
  await user.click(screen.getByRole("switch", { name: "允许本机工具读写" }));
  expect(model.onToggleMCP).toHaveBeenNthCalledWith(1);
  await user.click(screen.getByRole("button", { name: "关闭旧版读取" }));
  expect(model.onToggleMCP).toHaveBeenNthCalledWith(2, false);
  await user.click(screen.getByRole("button", { name: "在浏览器中打开" }));
  expect(model.onOpenLocalWeb).toHaveBeenCalledOnce();
  view.rerender(<WebSettings state={{ ...model, working: true }} />);
  expect(screen.getByRole("status").textContent).toBe("正在更新连接…");
  expect(screen.getByRole("switch").getAttribute("aria-disabled")).toBe("true");
  await user.click(screen.getByRole("switch"));
  expect(model.onToggleMCP).toHaveBeenCalledTimes(2);
  for (const name of ["关闭旧版读取", "在浏览器中打开"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<WebSettings state={{ ...model, capabilities: new Set() }} />);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByRole("button", { name: "在浏览器中打开" })).toBeNull();
});
