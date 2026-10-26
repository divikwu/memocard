// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UPDATE_GLOBALS } from "storybook/internal/core-events";
import { PreviewModeProvider } from "../preview-mode";
import { DEFAULT_PREVIEW_APPEARANCE } from "../preview-appearance";
import { useWebAppearance } from "./WebAppearance";
import { StorybookAppearanceBridge } from "./StorybookAppearanceBridge";

const events = vi.hoisted(() => {
  const listeners = new Map<string, Set<(event: { globals: Record<string, unknown> }) => void>>();
  return { listeners, channel: {
    on: (name: string, handler: (event: { globals: Record<string, unknown> }) => void) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(handler); },
    off: (name: string, handler: (event: { globals: Record<string, unknown> }) => void) => { listeners.get(name)?.delete(handler); },
    emit: vi.fn((name: string, event: { globals: Record<string, unknown> }) => { listeners.get(name)?.forEach(handler => handler(event)); }),
  } };
});
vi.mock("storybook/preview-api", () => ({ addons: { getChannel: () => events.channel } }));
vi.mock("../preview-fonts", async original => ({ ...await original<typeof import("../preview-fonts")>(), loadPreviewFonts: vi.fn().mockResolvedValue(undefined) }));
let dark = true;
let updateSystem: () => void;
beforeEach(() => { dark = true; events.channel.emit.mockClear(); vi.stubGlobal("matchMedia", () => ({ get matches() { return dark; }, addEventListener: (_event: string, handler: () => void) => { updateSystem = handler; }, removeEventListener: vi.fn() })); });
afterEach(() => { cleanup(); events.listeners.clear(); vi.unstubAllGlobals(); });
function Settings() {
  const controls = useWebAppearance()!;
  const [text, setText] = useState("");
  return <><select aria-label="主题" value={controls.value.theme} onChange={event => controls.onChange({ ...controls.value, theme: event.target.value as "light" | "dark" | "system" })}><option value="light">浅色</option><option value="dark">深色</option><option value="system">跟随系统</option></select><input aria-label="保留草稿" value={text} onChange={event => setText(event.target.value)} /><button onClick={() => controls.onChange({ ...controls.value, palette: "blue", neutralPalette: "slate" })}>冷灰蓝色</button><button onClick={controls.resetAppearance}>恢复默认</button></>;
}
const mount = () => render(<PreviewModeProvider mode="light"><StorybookAppearanceBridge><Settings /></StorybookAppearanceBridge></PreviewModeProvider>);

it("retains system in Web settings while publishing the actual OS mode and preserving live content", () => {
  mount();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "保留编辑" } }); input.focus();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "system" } });
  expect(screen.getByRole("combobox")).toHaveProperty("value", "system");
  expect(events.channel.emit).toHaveBeenLastCalledWith(UPDATE_GLOBALS, { globals: { ...DEFAULT_PREVIEW_APPEARANCE, theme: "dark" } });
  act(() => { dark = false; updateSystem(); });
  expect(events.channel.emit).toHaveBeenLastCalledWith(UPDATE_GLOBALS, { globals: { ...DEFAULT_PREVIEW_APPEARANCE, theme: "light" } });
  expect(screen.getByRole("combobox")).toHaveProperty("value", "system");
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveProperty("value", "保留编辑");
  expect(document.activeElement).toBe(input);
});

it("lets explicit toolbar themes leave system mode while font-only toolbar changes preserve it", () => {
  mount();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "system" } });
  act(() => events.channel.emit(UPDATE_GLOBALS, { globals: { bodyFont: "geist" } }));
  expect(screen.getByRole("combobox")).toHaveProperty("value", "system");
  act(() => events.channel.emit(UPDATE_GLOBALS, { globals: { theme: "light" } }));
  expect(screen.getByRole("combobox")).toHaveProperty("value", "light");
  events.channel.emit.mockClear();
  act(() => { dark = false; updateSystem(); });
  expect(events.channel.emit).not.toHaveBeenCalled();
});

it("applies local palette controls and reset without adding toolbar globals or clearing live input", () => {
  const view = mount();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "保留草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "冷灰蓝色" }));
  expect(document.documentElement.dataset.webPalette).toBe("blue");
  expect(document.documentElement.dataset.webNeutral).toBe("slate");
  expect(events.channel.emit).toHaveBeenLastCalledWith(UPDATE_GLOBALS, { globals: { ...DEFAULT_PREVIEW_APPEARANCE, theme: "light" } });
  fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
  expect(document.documentElement.dataset.webPalette).toBe("mono");
  expect(document.documentElement.dataset.webNeutral).toBe("neutral");
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveProperty("value", "保留草稿");
  view.unmount();
  expect(document.documentElement.dataset.webPalette).toBeUndefined();
});
