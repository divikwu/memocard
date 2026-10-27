// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useInputModality } from "./input-modality";

function Fields() {
  useInputModality();
  return <><input aria-label="文本" /><textarea aria-label="多行" /><input role="combobox" aria-label="选项" /><button>打开</button></>;
}
afterEach(cleanup);
const mode = () => document.documentElement.dataset.uiInputModality;

it("keeps pointer editing separate from keyboard navigation", () => {
  render(<Fields />);
  const input = screen.getByRole("textbox", { name: "文本" });
  fireEvent.pointerDown(input);
  for (const key of ["a", "ArrowLeft", "Backspace", "Shift", "Control"]) fireEvent.keyDown(input, { key });
  fireEvent.keyDown(input, { key: "Process", isComposing: true });
  expect(mode()).toBe("pointer");
  fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
  expect(mode()).toBe("keyboard");
  fireEvent.pointerDown(input);
  expect(mode()).toBe("pointer");
});

it("recognizes option navigation, form submission and dismissal without treating multiline Enter as navigation", () => {
  render(<Fields />);
  fireEvent.keyDown(screen.getByRole("textbox", { name: "多行" }), { key: "Enter" });
  expect(mode()).toBe("pointer");
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  expect(mode()).toBe("keyboard");
  fireEvent.pointerDown(screen.getByRole("textbox", { name: "文本" }));
  fireEvent.keyDown(screen.getByRole("textbox", { name: "文本" }), { key: "Enter" });
  expect(mode()).toBe("keyboard");
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(screen.getByRole("textbox", { name: "多行" }), { key: "Escape" });
  expect(mode()).toBe("keyboard");
});

it("keeps shortcut-driven focus transfers visible without adding a ring for editing commands", () => {
  render(<Fields />);
  const input = screen.getByRole("textbox", { name: "文本" });
  const target = screen.getByRole("combobox");
  fireEvent.pointerDown(input);
  input.focus();
  fireEvent.keyDown(input, { key: "a", metaKey: true });
  expect(mode()).toBe("pointer");
  fireEvent.keyDown(input, { key: "k", metaKey: true });
  target.focus();
  expect(mode()).toBe("keyboard");
  fireEvent.pointerDown(input);
  input.focus();
  expect(mode()).toBe("pointer");
});

it("shares the tracker between providers and releases it after the last unmount", () => {
  const first = render(<Fields />);
  const second = render(<Fields />);
  fireEvent.keyDown(document.body, { key: "Enter" });
  expect(mode()).toBe("keyboard");
  first.unmount();
  expect(mode()).toBe("keyboard");
  fireEvent.pointerDown(document.body);
  expect(mode()).toBe("pointer");
  second.unmount();
  expect(mode()).toBeUndefined();
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(mode()).toBeUndefined();
});
