import { afterEach, expect, test } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { ButtonStoryFrame, buttonDocsStories } from "../.storybook/button-docs.fixture";
import "../.storybook/preview.css";

afterEach(cleanup);

test("Sizes grows when its eight buttons wrap and shrinks again while staying centered", async () => {
  const Sizes = buttonDocsStories.Sizes;
  const options = Sizes.parameters.docs.story;
  expect(options.autoHeight).toBe(true);
  expect(options.centered).toBe(true);
  const { container } = render(<ButtonStoryFrame title="Sizes layout regression" layout={Sizes.parameters.layout}
    autoHeight={options.autoHeight} centered={options.centered}><Sizes /></ButtonStoryFrame>);
  const frame = container.querySelector("iframe")!;

  async function expectFits(width: number) {
    frame.style.width = `${width}px`;
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
      if (width === 700) {
        const first = buttons[0].getBoundingClientRect();
        const last = buttons.at(-1)!.getBoundingClientRect();
        expect(Math.abs((first.left + last.right) / 2 - bounds.left - bounds.width / 2)).toBeLessThanOrEqual(1);
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
