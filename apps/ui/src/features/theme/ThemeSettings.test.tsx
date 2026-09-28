// @vitest-environment jsdom
import { cleanup, render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { ThemeSettings } from "./ThemeSettings";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "./preferences";

let dark = false;
let mediaEvents: EventTarget;

function mountSettings() {
  return render(<ThemeProvider><ThemeSettings /></ThemeProvider>);
}

async function chooseSetting(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  localStorage.clear();
  dark = false;
  mediaEvents = new EventTarget();
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return dark; },
    addEventListener: mediaEvents.addEventListener.bind(mediaEvents),
    removeEventListener: mediaEvents.removeEventListener.bind(mediaEvents),
  })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("device appearance", () => {
  it("starts with Becoming's light, blue, neutral and 10px defaults", () => {
    dark = true;
    mountSettings();
    const root = document.documentElement;
    expect(root.classList.contains("light")).toBe(true);
    expect(root.dataset.palette).toBe("blue");
    expect(root.dataset.neutralPalette).toBe("neutral");
    expect(root.dataset.radius).toBe("lg");
    expect(root.style.getPropertyValue("--app-font-body")).toContain("Geist Variable");
  });

  it("persists color, radius and font changes across a remount", async () => {
    const user = userEvent.setup();
    const view = mountSettings();
    await chooseSetting(user, "强调色", "teal");
    await chooseSetting(user, "中性色", "slate");
    await chooseSetting(user, "圆角", "XL · 12px");
    await chooseSetting(user, "正文字体", "Inter");
    view.unmount();
    mountSettings();
    expect(document.documentElement.dataset.palette).toBe("teal");
    expect(document.documentElement.dataset.neutralPalette).toBe("slate");
    expect(document.documentElement.dataset.radius).toBe("xl");
    expect(document.documentElement.dataset.bodyFont).toBe("inter");
    expect(document.documentElement.style.getPropertyValue("--app-font-body")).toContain("Inter Variable");
  });

  it("follows system appearance only when selected and resets the full configuration", async () => {
    const user = userEvent.setup();
    mountSettings();
    await chooseSetting(user, "显示模式", "跟随系统");
    act(() => {
      dark = true;
      const event = new Event("change");
      Object.defineProperty(event, "matches", { value: true });
      mediaEvents.dispatchEvent(event);
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await chooseSetting(user, "强调色", "mono");
    await user.click(screen.getByRole("button", { name: "恢复默认" }));
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.dataset.palette).toBe("blue");
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual(DEFAULT_APPEARANCE);
  });

  it("recovers damaged stored preferences without applying unknown values", () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ palette: "unknown", radius: "-1", bodyFont: "missing", theme: "dark" }));
    mountSettings();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.palette).toBe("blue");
    expect(document.documentElement.dataset.radius).toBe("lg");
    expect(document.documentElement.dataset.bodyFont).toBe("geist");
  });

  it("keeps controls usable and reports when device storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Disabled", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Disabled", "SecurityError"); });
    const user = userEvent.setup();
    mountSettings();
    await chooseSetting(user, "显示模式", "深色");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("无法保存设置");
  });

  it("suppresses color transitions while applying a theme and cleans up pending frames", async () => {
    function ThemeControls() {
      const theme = useTheme();
      return <><button onClick={() => theme.setTheme("dark")}>深色</button><button onClick={() => theme.setTheme("light")}>浅色</button></>;
    }
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((frame: number) => frames.delete(frame)));
    const paint = () => {
      const pending = Array.from(frames);
      for (const [frame, callback] of pending) {
        frames.delete(frame);
        callback(0);
      }
    };
    const styleCount = () => document.head.querySelectorAll("[data-memocard-theme-transition]").length;
    const user = userEvent.setup();
    // Isolate the provider's frame cleanup from the Select popup's own animation frames.
    const view = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
    await user.click(screen.getByRole("button", { name: "深色" }));
    await user.click(screen.getByRole("button", { name: "浅色" }));
    expect(styleCount()).toBe(1);
    expect(frames.size).toBe(1);
    act(paint);
    expect(styleCount()).toBe(1);
    act(paint);
    expect(styleCount()).toBe(0);
    await user.click(screen.getByRole("button", { name: "深色" }));
    expect(styleCount()).toBe(1);
    view.unmount();
    expect(styleCount()).toBe(0);
    expect(frames.size).toBe(0);
  });
});
