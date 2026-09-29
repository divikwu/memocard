// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import TagEmojiPicker from "./tag-emoji-picker";
afterEach(cleanup);
it("searches Chinese names across categories and returns the native emoji", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<TagEmojiPicker selected="🎨" onSelect={onSelect} />);
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
