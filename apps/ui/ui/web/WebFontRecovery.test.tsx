// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AppViewState } from "../../src/App";
import { WebAppearanceProvider } from "./WebAppearance";
import { WebSettings } from "./WebSettings";
import { WebTypographyProvider } from "./WebTypographyProvider";

const appearanceKey = "memocard-web-appearance-v1";
const typographyKey = "memocard.typography.v1";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("FontFace", class {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.uiTheme;
  delete document.documentElement.dataset.uiAppearance;
  document.documentElement.removeAttribute("style");
});

it("reports a failed Chinese font and recovers through the real loader without changing saved preferences", async () => {
  const appearance = JSON.stringify({ theme: "dark", palette: "green", neutralPalette: "slate", radius: "none", headingFont: "noto-serif", bodyFont: "noto-sans" });
  const typography = JSON.stringify({ heading: "lora", body: "inter", mono: "geist-mono", measure: "70", size: "18", leading: "1.9", flow: "2em" });
  localStorage.setItem(appearanceKey, appearance);
  localStorage.setItem(typographyKey, typography);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  let recovering = false;
  let completeRecovery!: (faces: FontFace[]) => void;
  const recovery = new Promise<FontFace[]>(resolve => { completeRecovery = resolve; });
  const load = vi.fn((font: string, text: string) => {
    if (font.includes('"Noto Serif SC Variable"') && /[\u3400-\u9fff]/u.test(text)) {
      return recovering ? recovery : Promise.reject(new Error("Chinese font offline"));
    }
    return Promise.resolve([{} as FontFace]);
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: {
    load,
    ready: Promise.resolve(),
    *[Symbol.iterator]() {},
  } });
  const state = {
    status: { connected: true, vaultName: "测试笔记库", coverage: { indexed: 3, pending: 0, issues: 0, indexedAt: "2026-10-23T02:00:00Z" } },
    sidebar: { canChooseVault: true, canCreateVault: true, onSelectVault: vi.fn() },
    working: false, editor: null, capabilities: new Set(), environment: null, unsupportedBrowser: false,
  } as unknown as AppViewState;

  render(<WebAppearanceProvider><WebTypographyProvider><WebSettings state={state} /></WebTypographyProvider></WebAppearanceProvider>);
  const retry = await screen.findByRole("button", { name: "重试加载字体" });
  expect(screen.getByText("所选字体暂时无法加载，当前使用回退字体。")).toBeTruthy();
  expect(load.mock.calls.some(([font, text]) => font.includes('"Noto Serif Variable"') && text === "Aa")).toBe(true);
  await waitFor(() => {
    for (const family of ["Inter Variable", "Lora Variable", "Geist Mono Variable"]) {
      expect(load.mock.calls.some(([font, text]) => font.includes(`"${family}"`) && text === "Aa")).toBe(true);
    }
  });
  expect(screen.queryByText("字体加载失败，暂时使用系统字体。")).toBeNull();
  expect(errors).toHaveBeenCalledWith(expect.stringContaining("字体加载失败"), expect.any(Error));
  expect(localStorage.getItem(appearanceKey)).toBe(appearance);
  expect(localStorage.getItem(typographyKey)).toBe(typography);

  recovering = true;
  fireEvent.click(retry);
  expect(screen.getByText("正在加载所选字体，当前使用回退字体。")).toBeTruthy();
  await waitFor(() => expect(load.mock.calls.filter(([font, text]) => font.includes('"Noto Serif SC Variable"') && /[\u3400-\u9fff]/u.test(text))).toHaveLength(2));
  await act(async () => { completeRecovery([{} as FontFace]); });
  await waitFor(() => expect(screen.queryByText("正在加载所选字体，当前使用回退字体。")).toBeNull());
  expect(screen.queryByText("所选字体暂时无法加载，当前使用回退字体。")).toBeNull();
  expect(screen.queryByText("字体加载失败，暂时使用系统字体。")).toBeNull();
  expect(screen.queryByRole("button", { name: "重试加载字体" })).toBeNull();
  expect(localStorage.getItem(appearanceKey)).toBe(appearance);
  expect(localStorage.getItem(typographyKey)).toBe(typography);
});
