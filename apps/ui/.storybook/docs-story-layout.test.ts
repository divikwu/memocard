// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { observeDocsStoryLayout } from "./docs-story-layout";

const observers: TestResizeObserver[] = [];
const scheduled = new Map<number, FrameRequestCallback>();
const disposers: (() => void)[] = [];
let nextFrame = 0;

class TestResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(private readonly callback: ResizeObserverCallback) { observers.push(this); }
  notify() { this.callback([], this); }
}

function frameContent(height: number) {
  const frame = document.createElement("iframe");
  frame.style.height = "320px";
  document.body.append(frame);
  const content = frame.contentDocument!;
  content.body.style.cssText = "min-width: 320px; padding: 10px 0 8px";
  const root = content.createElement("div");
  root.id = "storybook-root";
  root.style.cssText = "display: block; min-height: 12px";
  content.body.append(root);
  const bounds = vi.spyOn(root, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, 0, 240, height));
  return { frame, content, root, bounds, setHeight: (next: number) => { height = next; } };
}

function observe(frame: HTMLIFrameElement, autoHeight = true) {
  const stop = observeDocsStoryLayout(frame, { autoHeight, centered: true });
  disposers.push(stop);
  return stop;
}

function flushFrame() {
  const callbacks = [...scheduled.values()];
  scheduled.clear();
  callbacks.forEach(callback => callback(0));
}

beforeEach(() => {
  observers.length = 0;
  scheduled.clear();
  nextFrame = 0;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
    scheduled.set(++nextFrame, callback);
    return nextFrame;
  }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => { scheduled.delete(id); }));
});

afterEach(() => {
  disposers.splice(0).forEach(dispose => dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("defers ResizeObserver writes and coalesces each frame using the latest content size", () => {
  const { frame, bounds, setHeight } = frameContent(64.2);
  observe(frame);
  expect(frame.style.height).toBe("83px");
  setHeight(112.4);
  observers[0].notify();
  setHeight(130.1);
  observers[0].notify();
  expect(frame.style.height).toBe("83px");
  expect(scheduled.size).toBe(1);
  flushFrame();
  expect(frame.style.height).toBe("149px");
  expect(bounds).toHaveBeenCalledTimes(2);
});

it("does not rewrite an unchanged iframe height after an observer notification", () => {
  const { frame } = frameContent(100);
  observe(frame);
  const write = vi.spyOn(frame.style, "height", "set");
  observers[0].notify();
  flushFrame();
  expect(write).not.toHaveBeenCalled();
});

it("cancels a queued resize and restores document styles when disposed", () => {
  const { frame, content, root, setHeight } = frameContent(100);
  const originalRoot = root.style.cssText;
  const stop = observe(frame);
  setHeight(200);
  observers[0].notify();
  expect(scheduled.size).toBe(1);
  stop();
  expect(scheduled.size).toBe(0);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(content.body.style.minWidth).toBe("320px");
  expect(root.style.cssText).toBe(originalRoot);
  flushFrame();
  expect(frame.style.height).toBe("118px");
});

it("cancels the old document's resize before observing a reloaded iframe", () => {
  const first = frameContent(100), second = frameContent(220);
  const originalRoot = first.root.style.cssText;
  observe(first.frame);
  first.setHeight(200);
  observers[0].notify();
  vi.spyOn(first.frame, "contentDocument", "get").mockReturnValue(second.content);
  first.frame.dispatchEvent(new Event("load"));
  expect(scheduled.size).toBe(0);
  expect(observers[0].disconnect).toHaveBeenCalledOnce();
  expect(first.root.style.cssText).toBe(originalRoot);
  expect(first.content.body.style.minWidth).toBe("320px");
  expect(observers[1].observe).toHaveBeenCalledWith(second.root);
  expect(first.frame.style.height).toBe("238px");
  flushFrame();
  expect(first.frame.style.height).toBe("238px");
});

it("preserves the fixed-height centered preview without an observer", () => {
  const { frame, root } = frameContent(100);
  observe(frame, false);
  expect(frame.style.height).toBe("320px");
  expect(root.style.minHeight).toBe("calc(100vh - 2rem)");
  expect(observers).toHaveLength(0);
  expect(scheduled.size).toBe(0);
});
