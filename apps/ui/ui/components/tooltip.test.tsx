// @vitest-environment jsdom
import { createPortal } from "react-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { TooltipHints } from "./tooltip";

afterEach(cleanup);

it("shows the shared tooltip immediately and restores existing descriptions after leaving", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><p id="help">已有说明</p><button data-ui-tooltip="完整路径 project/yami" aria-describedby="help">yami</button></TooltipHints>);
  const button = screen.getByRole("button");
  expect(button.title).toBe("");
  await user.hover(button);
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.textContent).toBe("完整路径 project/yami");
  expect(button.getAttribute("aria-describedby")).toBe(`help ${tooltip.id}`);
  await user.unhover(button);
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  expect(button.getAttribute("aria-describedby")).toBe("help");
});

it("describes the focused control when its truncated text owns the hint, and dismisses with Escape", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><button><span data-ui-tooltip="完整属性名称">属性</span></button><button>下一个</button></TooltipHints>);
  await user.tab();
  const button = screen.getByRole("button", { name: "属性" });
  const tooltip = await screen.findByRole("tooltip");
  expect(button.getAttribute("aria-describedby")).toBe(tooltip.id);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  expect(document.activeElement).toBe(button);
  await user.tab();
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("covers portal controls and newly created editor DOM without duplicate nested providers", async () => {
  const user = userEvent.setup();
  const page = render(<TooltipHints><TooltipHints>{createPortal(<button data-ui-tooltip="菜单提示">菜单</button>, document.body)}</TooltipHints></TooltipHints>);
  await user.hover(screen.getByRole("button"));
  expect(await screen.findAllByRole("tooltip")).toHaveLength(1);
  const button = document.createElement("button");
  button.setAttribute("data-ui-tooltip", "拖动调整列宽");
  button.textContent = "动态控件";
  page.container.append(button);
  await user.hover(button);
  await waitFor(() => expect(screen.getByRole("tooltip").textContent).toBe("拖动调整列宽"));
  button.remove();
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

it("allows hovering the tooltip and closes on click or scrolling", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><button data-ui-tooltip="说明">悬停</button></TooltipHints>);
  const button = screen.getByRole("button");
  await user.hover(button);
  await user.hover(await screen.findByRole("tooltip"));
  expect(screen.getByRole("tooltip")).toBeTruthy();
  fireEvent.scroll(document);
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  await userEvent.setup().hover(button);
  await screen.findByRole("tooltip");
  fireEvent.pointerDown(button, { pointerType: "mouse" });
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});

it("does not open on touch hover or swallow native title metadata", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><button data-ui-tooltip="说明">触摸</button><abbr title="Hypertext Markup Language">HTML</abbr></TooltipHints>);
  await user.pointer([{ keys: "[TouchA>]", target: screen.getByRole("button") }, { keys: "[/TouchA]" }]);
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(screen.getByText("HTML").getAttribute("title")).toBe("Hypertext Markup Language");
});

it("only shows focus-only hints after keyboard focus, with Escape and blur dismissal", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><button>起点</button><button data-ui-tooltip="使用上、下方向键排序" data-ui-tooltip-focus-only>拖动柄</button><button>下一个</button></TooltipHints>);
  const grip = screen.getByRole("button", { name: "拖动柄" });
  await user.hover(grip);
  expect(screen.queryByRole("tooltip")).toBeNull();
  await user.click(grip);
  expect(screen.queryByRole("tooltip")).toBeNull();
  await user.unhover(grip);
  await user.click(screen.getByRole("button", { name: "起点" }));
  await user.tab();
  const tooltip = await screen.findByRole("tooltip");
  expect(grip.getAttribute("aria-describedby")).toBe(tooltip.id);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  expect(document.activeElement).toBe(grip);
  await user.tab();
  await user.tab({ shift: true });
  await screen.findByRole("tooltip");
  await user.tab();
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  expect(grip.hasAttribute("aria-describedby")).toBe(false);
});

it("only reveals overflow hints when the visible label is clipped, including keyboard focus", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><button data-ui-tooltip="完整名称"><span data-ui-tooltip-overflow>名称</span></button><button>下一个</button></TooltipHints>);
  const button = screen.getByRole("button", { name: "名称" }), label = screen.getByText("名称");
  let width = 80;
  Object.defineProperties(label, { clientWidth: { value: 80 }, scrollWidth: { get: () => width } });
  await user.hover(button);
  expect(screen.queryByRole("tooltip")).toBeNull();
  await user.unhover(button);
  await user.tab();
  expect(screen.queryByRole("tooltip")).toBeNull();
  await user.tab();
  width = 240;
  await user.tab({ shift: true });
  expect((await screen.findByRole("tooltip")).textContent).toBe("完整名称");
  await user.keyboard("{Escape}");
  await user.hover(button);
  expect((await screen.findByRole("tooltip")).textContent).toBe("完整名称");
  await user.unhover(button);
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  width = 80;
  await user.hover(button);
  expect(screen.queryByRole("tooltip")).toBeNull();
});
