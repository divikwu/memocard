// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const load = vi.fn();
beforeEach(() => {
  vi.resetModules();
  load.mockReset().mockResolvedValue([{}]);
  Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
});
afterEach(() => { vi.restoreAllMocks(); });

it("shares duplicate font work across concurrent selections and skips system fonts", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  await Promise.all([loadPreviewFonts(["geist", "geist"]), loadPreviewFonts(["geist", "system-mono"])]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith('400 16px "Geist Variable"', "Aa");
});

it("rejects missing font faces and permits a later selection to retry", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  load.mockResolvedValueOnce([]);
  await expect(loadPreviewFonts(["geist"])).rejects.toThrow("Unable to load Geist.");
  await expect(loadPreviewFonts(["geist"])).resolves.toEqual([[{}]]);
  expect(load).toHaveBeenCalledTimes(2);
});
