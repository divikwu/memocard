// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Toggle } from "./toggle";

afterEach(cleanup);

it("resolves Button callback classes when disabled changes and merges variant overrides", async () => {
  const user = userEvent.setup();
  const click = vi.fn();
  const className = vi.fn(({ disabled }: { disabled: boolean }) =>
    `h-10 bg-warning-muted ${disabled ? "button-disabled" : "button-enabled"}`,
  );
  const view = render(<Button className={className} onClick={click}>保存</Button>);
  const button = screen.getByRole("button", { name: "保存" });
  expect(button.classList.contains("button-enabled")).toBe(true);
  expect([...button.classList].filter(value => value.startsWith("h-"))).toEqual(["h-10"]);
  expect(button.classList.contains("bg-accent-bg")).toBe(false);
  await user.click(button);
  expect(click).toHaveBeenCalledTimes(1);

  view.rerender(<Button className={className} onClick={click} disabled>保存</Button>);
  expect(button.classList.contains("button-disabled")).toBe(true);
  expect(button.classList.contains("button-enabled")).toBe(false);
  expect(className).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }));
  await user.click(button);
  expect(click).toHaveBeenCalledTimes(1);
});

it("updates Checkbox callback classes after user selection", async () => {
  const user = userEvent.setup();
  const className = vi.fn(({ checked }: { checked: boolean }) => checked ? "checkbox-selected" : "checkbox-empty");
  render(<Checkbox aria-label="接收通知" className={className} />);
  const checkbox = screen.getByRole("checkbox", { name: "接收通知" });
  expect(checkbox.classList.contains("checkbox-empty")).toBe(true);
  await user.click(checkbox);
  expect(checkbox.getAttribute("aria-checked")).toBe("true");
  expect(checkbox.classList.contains("checkbox-selected")).toBe(true);
  expect(checkbox.classList.contains("checkbox-empty")).toBe(false);
  expect(className).toHaveBeenLastCalledWith(expect.objectContaining({ checked: true }));
});

it("updates Toggle callback classes after pressing and releasing", async () => {
  const user = userEvent.setup();
  const className = vi.fn(({ pressed }: { pressed: boolean }) => pressed ? "toggle-on" : "toggle-off");
  render(<Toggle aria-label="加粗" className={className}>B</Toggle>);
  const toggle = screen.getByRole("button", { name: "加粗" });
  expect(toggle.classList.contains("toggle-off")).toBe(true);
  await user.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(toggle.classList.contains("toggle-on")).toBe(true);
  await user.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  expect(toggle.classList.contains("toggle-off")).toBe(true);
  expect(toggle.classList.contains("toggle-on")).toBe(false);
});

it("resolves popup, group, label and separator callbacks in a real opened menu", async () => {
  const user = userEvent.setup();
  const popupClasses = vi.fn(({ open }: { open: boolean }) => `min-w-64 ${open ? "menu-open" : "menu-closed"}`);
  const groupClasses = vi.fn(() => "menu-group");
  const labelClasses = vi.fn(() => "p-1 menu-label");
  const separatorClasses = vi.fn(() => "bg-error menu-separator");
  render(<DropdownMenu>
    <DropdownMenuTrigger render={<Button />}>项目操作</DropdownMenuTrigger>
    <DropdownMenuContent className={popupClasses}>
      <DropdownMenuGroup className={groupClasses}>
        <DropdownMenuLabel className={labelClasses}>项目</DropdownMenuLabel>
        <DropdownMenuItem>归档</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator className={separatorClasses} />
      <DropdownMenuItem>删除</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>);
  await user.click(screen.getByRole("button", { name: "项目操作" }));
  const popup = await screen.findByRole("menu");
  expect(popup.classList.contains("menu-open")).toBe(true);
  expect(popup.classList.contains("min-w-64")).toBe(true);
  expect(popup.classList.contains("min-w-48")).toBe(false);
  expect(screen.getByRole("group", { name: "项目" }).classList.contains("menu-group")).toBe(true);
  const label = screen.getByText("项目", { exact: true });
  expect(label.classList.contains("menu-label")).toBe(true);
  expect(label.classList.contains("p-1")).toBe(true);
  expect(label.classList.contains("px-3")).toBe(false);
  expect(label.classList.contains("py-2.5")).toBe(false);
  const separator = screen.getByRole("separator");
  expect(separator.classList.contains("menu-separator")).toBe(true);
  expect(separator.classList.contains("bg-error")).toBe(true);
  expect(separator.classList.contains("bg-border/50")).toBe(false);
  await user.click(screen.getByRole("menuitem", { name: "归档" }));
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
});

it("preserves string class overrides when merging component defaults", () => {
  render(<><Button className="h-10 rounded-none bg-warning-muted">保存</Button><Checkbox aria-label="订阅" className="size-6 rounded-full" /><Toggle aria-label="斜体" className="h-8 rounded-none">I</Toggle></>);
  const button = screen.getByRole("button", { name: "保存" });
  expect([...button.classList].filter(value => value.startsWith("h-"))).toEqual(["h-10"]);
  expect(button.classList.contains("rounded-none")).toBe(true);
  expect(button.classList.contains("rounded-4xl")).toBe(false);
  expect(button.classList.contains("bg-accent-bg")).toBe(false);
  const checkbox = screen.getByRole("checkbox", { name: "订阅" });
  expect(checkbox.classList.contains("size-6")).toBe(true);
  expect(checkbox.classList.contains("size-4")).toBe(false);
  expect(checkbox.classList.contains("rounded-full")).toBe(true);
  const toggle = screen.getByRole("button", { name: "斜体" });
  expect([...toggle.classList].filter(value => value.startsWith("h-"))).toEqual(["h-8"]);
  expect(toggle.classList.contains("rounded-none")).toBe(true);
});

it.each(["string", "callback"] as const)("allows %s square-button size overrides of semantic defaults", (pattern) => {
  const classes = "size-10";
  render(<Button size="icon" aria-label="搜索" className={pattern === "callback" ? () => classes : classes} />);
  const button = screen.getByRole("button", { name: "搜索" });
  expect([...button.classList].filter(value => value.startsWith("size-"))).toEqual(["size-10"]);
});

it.each(["string", "callback"] as const)("allows %s popup motion overrides of semantic defaults", async (pattern) => {
  const user = userEvent.setup();
  const classes = "duration-300 ease-linear";
  render(<DropdownMenu>
    <DropdownMenuTrigger render={<Button />}>更多操作</DropdownMenuTrigger>
    <DropdownMenuContent className={pattern === "callback" ? () => classes : classes}>
      <DropdownMenuItem>归档</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>);
  await user.click(screen.getByRole("button", { name: "更多操作" }));
  const popup = await screen.findByRole("menu");
  expect([...popup.classList].filter(value => value.startsWith("duration-"))).toEqual(["duration-300"]);
  expect([...popup.classList].filter(value => value.startsWith("ease-"))).toEqual(["ease-linear"]);
});

it("shows a distinct indicator for mixed and checked Checkbox states", () => {
  const view = render(<Checkbox aria-label="全部通知" checked={false} indeterminate />);
  const checkbox = screen.getByRole("checkbox", { name: "全部通知" });
  expect(checkbox.getAttribute("aria-checked")).toBe("mixed");
  const mixedGlyph = checkbox.querySelector("svg")?.innerHTML;
  expect(mixedGlyph).toBeTruthy();
  view.rerender(<Checkbox aria-label="全部通知" checked indeterminate={false} />);
  expect(checkbox.getAttribute("aria-checked")).toBe("true");
  const checkedGlyph = checkbox.querySelector("svg")?.innerHTML;
  expect(checkedGlyph).toBeTruthy();
  expect(checkedGlyph).not.toBe(mixedGlyph);
});

it("keeps disabled non-native selection controls unchanged and exposes their disabled state", async () => {
  const user = userEvent.setup();
  const changeCheckbox = vi.fn();
  const changeRadio = vi.fn();
  render(<><Checkbox aria-label="禁用通知" disabled onCheckedChange={changeCheckbox} />
    <RadioGroup aria-label="通知方式" defaultValue="email" onValueChange={changeRadio}>
      <RadioGroupItem aria-label="邮件" value="email" />
      <RadioGroupItem aria-label="短信" value="sms" disabled />
    </RadioGroup></>);
  const checkbox = screen.getByRole("checkbox", { name: "禁用通知" });
  const radio = screen.getByRole("radio", { name: "短信" });
  for (const control of [checkbox, radio]) {
    expect(control.hasAttribute("data-disabled")).toBe(true);
    expect(control.getAttribute("aria-disabled")).toBe("true");
    await user.click(control);
    expect(control.getAttribute("aria-checked")).toBe("false");
  }
  expect(changeCheckbox).not.toHaveBeenCalled();
  expect(changeRadio).not.toHaveBeenCalled();
});
