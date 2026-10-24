// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_PREVIEW_APPEARANCE, parsePreviewAppearance } from "./preview-appearance";
import { PREVIEW_FONTS, loadPreviewFonts } from "./preview-fonts";
import { PreviewModeProvider, usePreviewGlobalsParam } from "./preview-mode";

vi.mock("./preview-fonts", async importOriginal => ({
  ...await importOriginal<typeof import("./preview-fonts")>(),
  loadPreviewFonts: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete document.documentElement.dataset.uiNextAppearance;
  delete document.documentElement.dataset.uiTheme;
  document.documentElement.removeAttribute("style");
});

it("keeps project defaults and rejects unsupported URL globals", () => {
  expect(parsePreviewAppearance({})).toEqual(DEFAULT_PREVIEW_APPEARANCE);
  expect(parsePreviewAppearance({ radius: "2xl", headingFont: "missing-font", bodyFont: "url(example.com)" })).toEqual(DEFAULT_PREVIEW_APPEARANCE);
  expect(parsePreviewAppearance({ radius: "none", headingFont: "noto-sans", bodyFont: "noto-serif" })).toEqual({ radius: "none", headingFont: "noto-sans", bodyFont: "noto-serif" });
});

function CanvasLink() {
  return <a href={`/?path=/story/ui-next-button--example&globals=${usePreviewGlobalsParam()}`}>Canvas</a>;
}

it("updates preview roles and Canvas links without remounting live content", () => {
  const { rerender } = render(<PreviewModeProvider mode="light"><CanvasLink /><input aria-label="草稿" defaultValue="保留输入" /></PreviewModeProvider>);
  const input = screen.getByRole("textbox");
  input.focus();
  rerender(<PreviewModeProvider mode="dark" appearance={{ radius: "large", headingFont: "noto-sans", bodyFont: "noto-serif" }}><CanvasLink /><input aria-label="草稿" defaultValue="保留输入" /></PreviewModeProvider>);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(screen.getByRole("link").getAttribute("href")).toContain("theme:dark;radius:large;headingFont:noto-sans;bodyFont:noto-serif");
  const root = document.documentElement;
  expect(root.dataset.uiTheme).toBe("dark");
  expect(root.hasAttribute("data-ui-next-appearance")).toBe(true);
  expect(root.style.getPropertyValue("--ui-next-preview-radius")).toBe("0.875rem");
  expect(root.style.getPropertyValue("--ui-next-preview-heading")).toBe(PREVIEW_FONTS.find(font => font.id === "noto-sans")!.fontFamily);
  expect(root.style.getPropertyValue("--ui-next-preview-body")).toBe(PREVIEW_FONTS.find(font => font.id === "noto-serif")!.fontFamily);
  expect(root.style.getPropertyValue("--font-family-code")).toBe("");
});

it("resolves inherit against the selected body font and restores defaults", () => {
  const { rerender } = render(<PreviewModeProvider mode="light" appearance={{ radius: "none", headingFont: "inherit", bodyFont: "inter" }}>内容</PreviewModeProvider>);
  const root = document.documentElement;
  expect(root.style.getPropertyValue("--ui-next-preview-heading")).toBe(root.style.getPropertyValue("--ui-next-preview-body"));
  expect(loadPreviewFonts).toHaveBeenLastCalledWith(["inter", "inter"]);
  rerender(<PreviewModeProvider mode="light">内容</PreviewModeProvider>);
  expect(root.style.getPropertyValue("--ui-next-preview-radius")).toBe("0.5rem");
  expect(root.style.getPropertyValue("--ui-next-preview-heading")).toBe(root.style.getPropertyValue("--ui-next-preview-body"));
  expect(root.style.getPropertyValue("--ui-next-preview-body")).toContain("Noto Sans Variable");
  expect(loadPreviewFonts).toHaveBeenLastCalledWith(["noto-sans", "noto-sans"]);
});
