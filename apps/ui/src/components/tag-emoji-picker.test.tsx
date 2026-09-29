// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import TagEmojiPicker from "./tag-emoji-picker";
afterEach(cleanup);
it("searches Chinese names across categories and returns the native emoji", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<TagEmojiPicker onSelect={onSelect} />);
  await user.type(screen.getByRole("textbox", { name: "搜索 Emoji" }), "调色板");
  await user.click(screen.getByRole("button", { name: /调色板/ }));
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("🎨");
  await user.clear(screen.getByRole("textbox", { name: "搜索 Emoji" }));
  await user.type(screen.getByRole("textbox", { name: "搜索 Emoji" }), "no-matching-emoji");
  expect(screen.getByRole("status").textContent).toBe("没有匹配的 Emoji");
});
