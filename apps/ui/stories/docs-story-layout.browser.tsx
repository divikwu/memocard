import { afterEach, expect, test } from "vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { ButtonStoryFrame, buttonDocsStories } from "../.storybook/button-docs.fixture";
import { observeDocsStoryLayout } from "../.storybook/docs-story-layout";
import "../.storybook/preview.css";

afterEach(cleanup);

test("auto height converges for viewport-relative content without ResizeObserver feedback errors", async () => {
  const frame = document.createElement("iframe");
  Object.assign(frame.style, { width: "320px", height: "512px", border: "0" });
  const loaded = new Promise<void>(resolve => frame.addEventListener("load", () => resolve(), { once: true }));
  document.body.append(frame);
  await loaded;
  const content = frame.contentDocument!, view = content.defaultView!;
  Object.assign(content.body.style, { margin: "0", padding: "16px" });
  const root = content.createElement("div");
  root.id = "storybook-root";
  root.innerHTML = '<div style="height:50vh"></div>';
  content.body.append(root);
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => { errors.push(event.message); };
  window.addEventListener("error", onError);
  view.addEventListener("error", onError);
  const stop = observeDocsStoryLayout(frame, { autoHeight: true, centered: true });
  try {
    await waitFor(() => expect(frame.clientHeight).toBe(65));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(frame.clientHeight).toBe(65);
    expect(content.documentElement.scrollHeight).toBeLessThanOrEqual(frame.clientHeight);
    expect(errors).toEqual([]);
  } finally {
    stop();
    window.removeEventListener("error", onError);
    view.removeEventListener("error", onError);
    frame.remove();
  }
});

test("Properties keeps readable row controls and confines narrow overflow to its table", async () => {
  const Properties = buttonDocsStories.Properties;
  const { container } = render(<ButtonStoryFrame title="Properties narrow layout" layout="fullscreen" autoHeight><Properties /></ButtonStoryFrame>);
  const frame = container.querySelector("iframe")!;
  for (const width of [896, 390, 320]) {
    frame.style.width = `${width}px`;
    await waitFor(() => {
      const content = frame.contentDocument!;
      const table = content.querySelector(".component-docs-properties-table-wrap")!;
      expect(content.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      expect(content.documentElement.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1);
      for (const control of table.querySelectorAll('[data-slot="input"], button[role="combobox"]')) {
        expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
      }
      if (width < 640) expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
    });
  }
});

test("Actions gives its confirmation dialog enough canvas height without story scrolling", async () => {
  const Actions = buttonDocsStories.Actions;
  const options = Actions.parameters.docs.story;
  const { container } = render(<ButtonStoryFrame title="Actions layout" layout={Actions.parameters.layout}
    autoHeight={options.autoHeight} centered={options.centered} height={options.height}><Actions /></ButtonStoryFrame>);
  const frame = container.querySelector("iframe")!;
  for (const width of [896, 320]) {
    frame.style.width = `${width}px`;
    await waitFor(() => {
      expect(frame.clientHeight).toBeGreaterThanOrEqual(320);
      expect(frame.contentDocument!.documentElement.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1);
      expect(frame.contentDocument!.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    });
  }
});

test("Sizes keeps labeled buttons within the canvas when its groups wrap and resize", async () => {
  const Sizes = buttonDocsStories.Sizes;
  const options = Sizes.parameters.docs.story;
  expect(options.autoHeight).toBe(true);
  expect(options.centered).toBe(true);
  const { container } = render(<ButtonStoryFrame title="Sizes layout regression" layout={Sizes.parameters.layout}
    autoHeight={options.autoHeight} centered={options.centered}><Sizes /></ButtonStoryFrame>);
  const frame = container.querySelector("iframe")!;

  async function expectFits(width: number) {
    frame.style.width = `${width}px`;
    await frame.contentDocument!.fonts.ready;
    await waitFor(() => {
      const content = frame.contentDocument!;
      const root = content.getElementById("storybook-root")!;
      const buttons = [...root.querySelectorAll("button")];
      expect(buttons.map(button => button.dataset.size)).toEqual(["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"]);
      const bodyStyle = content.defaultView!.getComputedStyle(content.body);
      const bounds = root.getBoundingClientRect();
      const height = bounds.height + parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
      expect(parseFloat(frame.style.height)).toBe(Math.ceil(height));
      expect(content.documentElement.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1);
      expect(Math.max(content.body.scrollWidth, content.documentElement.scrollWidth), JSON.stringify({
        viewport: content.defaultView!.innerWidth,
        bodyMinWidth: bodyStyle.minWidth,
        htmlMinWidth: content.defaultView!.getComputedStyle(content.documentElement).minWidth,
        rootMinWidth: content.defaultView!.getComputedStyle(root).minWidth,
      })).toBeLessThanOrEqual(frame.clientWidth + 1);
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        expect(rect.top).toBeGreaterThanOrEqual(0);
        expect(rect.bottom).toBeLessThanOrEqual(frame.clientHeight);
      }
      const group = root.firstElementChild!.getBoundingClientRect();
      expect(Math.abs(group.left + group.width / 2 - bounds.left - bounds.width / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(group.top + group.height / 2 - bounds.top - bounds.height / 2)).toBeLessThanOrEqual(1);
      expect(buttons.map(button => button.getBoundingClientRect().height)).toEqual([24, 32, 36, 40, 24, 32, 36, 40]);
      for (const size of ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"]) {
        expect([...root.querySelectorAll("code")].some(label => label.textContent === size)).toBe(true);
      }
    });
    return parseFloat(frame.style.height);
  }

  const wide = await expectFits(700);
  // Production body uses min-w-80; exercise its existing 320px lower bound.
  const narrow = await expectFits(320);
  expect(narrow).toBeGreaterThan(wide);
  expect(await expectFits(700)).toBe(wide);
});

test("States wraps all six variants without clipping disabled and loading buttons", async () => {
  const States = buttonDocsStories.States;
  const options = States.parameters.docs.story;
  const { container } = render(<ButtonStoryFrame title="States layout regression" layout={States.parameters.layout}
    autoHeight={options.autoHeight} centered={options.centered}><States /></ButtonStoryFrame>);
  const frame = container.querySelector("iframe")!;
  for (const width of [320, 800, 320]) {
    frame.style.width = `${width}px`;
    await frame.contentDocument!.fonts.ready;
    await waitFor(() => {
      const content = frame.contentDocument!;
      const buttons = [...content.querySelectorAll("button")];
      expect(buttons).toHaveLength(18);
      expect(buttons.filter(button => button.disabled)).toHaveLength(12);
      expect(buttons.filter(button => button.getAttribute("aria-busy") === "true")).toHaveLength(6);
      expect(content.documentElement.scrollWidth).toBeLessThanOrEqual(frame.clientWidth + 1);
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(frame.clientWidth + 1);
        expect(rect.bottom).toBeLessThanOrEqual(frame.clientHeight + 1);
      }
    });
  }
});

test("Examples follows the Docs page without an inner scrollbar as code and width change", async () => {
  const Examples = buttonDocsStories.Examples;
  const options = Examples.parameters.docs.story;
  const { container } = render(<ButtonStoryFrame title="Examples layout regression" layout={Examples.parameters.layout}
    autoHeight={options.autoHeight} centered={options.centered}><Examples /></ButtonStoryFrame>);
  const frame = container.querySelector("iframe")!;
  const content = frame.contentDocument!;
  const icon = within(content.body).getByRole("region", { name: "Button — Icon" });

  async function expectFits() {
    await content.fonts.ready;
    await waitFor(() => {
      expect(content.documentElement.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1);
      expect(content.documentElement.scrollWidth).toBeLessThanOrEqual(frame.clientWidth + 1);
      const cards = content.querySelectorAll(".component-docs-example");
      expect(cards).toHaveLength(4);
      expect(cards[3].getBoundingClientRect().bottom).toBeLessThanOrEqual(frame.clientHeight);
      expect(frame.clientHeight).toBeLessThanOrEqual(content.querySelector(".button-examples")!.getBoundingClientRect().bottom + 1);
    });
    return frame.clientHeight;
  }

  for (const width of [896, 320, 896]) {
    frame.style.width = `${width}px`;
    const descriptionHeight = await expectFits();
    await userEvent.click(within(icon).getByRole("tab", { name: "Code" }));
    await waitFor(() => expect(within(icon).getByRole("tabpanel", { name: "Code" }).querySelector("pre")).toBeVisible());
    await expectFits();
    expect(frame.clientHeight).toBeGreaterThan(descriptionHeight);
    await userEvent.click(within(icon).getByRole("tab", { name: "描述" }));
    await expectFits();
    await waitFor(() => expect(frame.clientHeight).toBe(descriptionHeight));
  }
});
