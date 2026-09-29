// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TagEmojiPicker from "./tag-emoji-picker";
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(cleanup);
it("searches Chinese names across categories and returns the native emoji", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<TagEmojiPicker selected="🎨" onSelect={onSelect} />);
  const categories = screen.getAllByRole("button", { name: /Emoji 分类：/ });
  expect(screen.getByLabelText("Emoji 分类").className).toContain("-mx-3");
  expect(categories).toHaveLength(8);
  expect(categories[0].getAttribute("aria-pressed")).toBe("true");
  screen.getByRole("button", { name: "Emoji 分类：动物与自然" }).focus();
  expect((await screen.findByRole("tooltip")).textContent).toContain("动物与自然");
  await user.click(screen.getByRole("button", { name: "Emoji 分类：动物与自然" }));
  expect(screen.getByRole("button", { name: "Emoji 分类：动物与自然" }).getAttribute("aria-pressed")).toBe("true");
  await user.type(screen.getByRole("textbox", { name: "搜索 Emoji" }), "调色板");
  const palette = screen.getByRole("button", { name: /调色板/ });
  expect(palette.getAttribute("aria-pressed")).toBe("true");
  expect(palette.className).toContain("bg-accent");
  await user.click(palette);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("🎨");
  await user.clear(screen.getByRole("textbox", { name: "搜索 Emoji" }));
  await user.type(screen.getByRole("textbox", { name: "搜索 Emoji" }), "no-matching-emoji");
  expect(screen.getByRole("status").textContent).toBe("没有匹配的 Emoji");
});
