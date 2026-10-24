// @vitest-environment jsdom
import { useId, type ComponentProps } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, expectTypeOf, it, vi } from "vitest";
import { additionalComponentDocs } from "../additional-component-docs.data";
import { ComboboxExample } from "../AdditionalExamples";
import { Badge } from "./badge";
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxInput, ComboboxTrigger, ComboboxValue } from "./combobox";
import { Label } from "./label";
import { Separator } from "./separator";

afterEach(cleanup);

function FontPicker(props: ComponentProps<typeof ComboboxInput>) {
  const id = useId();
  return <><Label id={`${id}-label`} htmlFor={id}>字体</Label><Combobox items={["Noto Sans", "Noto Serif"]} defaultValue="Noto Sans"><ComboboxInput id={id} aria-labelledby={`${id}-label`} showClear {...props} /></Combobox></>;
}

it("preserves each example's explicit reference to its visible label", () => {
  render(<><ComboboxExample /><ComboboxExample /></>);
  const inputs = screen.getAllByRole("combobox", { name: "字体" });
  const labelIds = inputs.map(input => input.getAttribute("aria-labelledby"));
  expect(new Set(labelIds).size).toBe(inputs.length);
  for (const input of inputs) {
    const labelId = input.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const label = document.getElementById(labelId!) as HTMLLabelElement;
    expect(label.tagName).toBe("LABEL");
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toBe("字体");
  }
});

it("names built-in Combobox actions and keeps the trigger named after clearing", async () => {
  const user = userEvent.setup();
  render(<FontPicker />);
  const input = screen.getByRole("combobox", { name: "字体" }) as HTMLInputElement;
  expect(input.value).toBe("Noto Sans");
  expect(screen.getByRole("button", { name: "切换选项" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "清除选择" }));
  await waitFor(() => expect(input.value).toBe(""));
  await waitFor(() => expect(screen.queryByRole("button", { name: "清除选择" })).toBeNull());
  expect(screen.getByRole("button", { name: "切换选项" })).toBeTruthy();
});

it("allows localized names for ComboboxInput built-in actions", () => {
  render(<FontPicker triggerAriaLabel="Toggle font options" clearAriaLabel="Clear selected font" />);
  expect(screen.getByRole("button", { name: "Toggle font options" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Clear selected font" })).toBeTruthy();
});

it("preserves an explicit name when composing ComboboxTrigger directly", () => {
  render(<Combobox items={["Noto Sans"]} defaultValue="Noto Sans"><ComboboxInput aria-label="字体" showTrigger={false} /><ComboboxTrigger aria-label="选择字体" /></Combobox>);
  expect(screen.getByRole("button", { name: "选择字体" })).toBeTruthy();
});

it("names selected chips and removes only the chosen value", async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const fonts = ["Noto Sans", "Noto Serif"];
  render(<Combobox multiple items={fonts} defaultValue={fonts} onValueChange={change}><ComboboxChips><ComboboxValue>{(values: string[]) => values.map(font => <ComboboxChip key={font}>{font}</ComboboxChip>)}</ComboboxValue><ComboboxChipsInput aria-label="字体" /></ComboboxChips></Combobox>);
  expect(screen.getByRole("button", { name: "移除 Noto Serif" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "移除 Noto Sans" }));
  expect(change.mock.calls.at(-1)?.[0]).toEqual(["Noto Serif"]);
  expect(screen.queryByRole("button", { name: "移除 Noto Sans" })).toBeNull();
  expect(screen.getByRole("button", { name: "移除 Noto Serif" })).toBeTruthy();
});

it("provides a fallback for complex chip content and permits a specific remove name", async () => {
  const user = userEvent.setup();
  const change = vi.fn();
  const fonts = ["Noto Sans", "Noto Serif"];
  render(<Combobox multiple items={fonts} defaultValue={fonts} onValueChange={change}><ComboboxChips><ComboboxValue>{(values: string[]) => values.map(font => <ComboboxChip key={font} removeAriaLabel={font === "Noto Serif" ? "Remove serif font" : undefined}><span>{font}</span></ComboboxChip>)}</ComboboxValue><ComboboxChipsInput aria-label="字体" /></ComboboxChips></Combobox>);
  expect(screen.getByRole("button", { name: "移除选项" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Remove serif font" }));
  expect(change.mock.calls.at(-1)?.[0]).toEqual(["Noto Sans"]);
  expect(screen.queryByRole("button", { name: "Remove serif font" })).toBeNull();
  expect(screen.getByRole("button", { name: "移除选项" })).toBeTruthy();
});

it("merges Separator state callback classes and updates them with orientation", () => {
  const className = vi.fn((state: { orientation: "horizontal" | "vertical" }) => `custom-${state.orientation}`);
  const { rerender } = render(<Separator className={className} />);
  expect(screen.getByRole("separator").classList.contains("custom-horizontal")).toBe(true);
  expect(screen.getByRole("separator").classList.contains("bg-divider")).toBe(true);
  expect(className).toHaveBeenCalledWith({ orientation: "horizontal" });
  rerender(<Separator orientation="vertical" className={className} />);
  expect(screen.getByRole("separator").classList.contains("custom-vertical")).toBe(true);
  expect(screen.getByRole("separator").classList.contains("custom-horizontal")).toBe(false);
  expect(className).toHaveBeenCalledWith({ orientation: "vertical" });
});

it("preserves string class names on Separator", () => {
  render(<Separator className="custom-separator" />);
  expect(screen.getByRole("separator").classList.contains("custom-separator")).toBe(true);
  expect(screen.getByRole("separator").classList.contains("bg-divider")).toBe(true);
});

it("documents Badge className consistently with its native span contract", () => {
  expectTypeOf<ComponentProps<typeof Badge>["className"]>().toEqualTypeOf<string | undefined>();
  expect(additionalComponentDocs.badge.props.find(prop => prop.name === "className")?.type).toBe("string");
});
