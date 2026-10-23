// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { Slider } from "./slider";
import { Progress, ProgressLabel } from "./progress";

const style = document.createElement("style");
beforeAll(() => {
  style.textContent = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "progress.css"), "utf8");
  document.head.append(style);
});
afterEach(cleanup);
afterAll(() => style.remove());

it.each([0, 10])("defaults to one slider at min=%i without duplicate tab stops", min => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<Slider min={min} aria-label="默认值" />);
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
  expect(inputs).toHaveLength(1);
  expect(inputs[0].value).toBe(String(min));
  const thumbs = container.querySelectorAll('[data-slot="slider-thumb"]');
  expect(thumbs).toHaveLength(1);
  expect(thumbs[0].getAttribute("data-index")).toBe("0");
});

it.each([{ defaultValue: 20 }, { defaultValue: [20, 80] }])("preserves SSR values and indices: $defaultValue", ({ defaultValue }) => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<Slider defaultValue={defaultValue} aria-label="指定值" />);
  const values = Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  expect(Array.from(container.querySelectorAll('input[type="range"]'), input => input.getAttribute("value"))).toEqual(values.map(String));
  expect(Array.from(container.querySelectorAll('[data-slot="slider-thumb"]'), thumb => thumb.getAttribute("data-index"))).toEqual(values.map((_, index) => String(index)));
});

it("preserves controlled range values during SSR", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<Slider value={[20, 80]} aria-label="受控范围" />);
  expect(Array.from(container.querySelectorAll('input[type="range"]'), input => input.getAttribute("value"))).toEqual(["20", "80"]);
  expect(Array.from(container.querySelectorAll('[data-slot="slider-thumb"]'), thumb => thumb.getAttribute("data-index"))).toEqual(["0", "1"]);
});

it("keeps an indeterminate segment visible and distinct from zero progress", () => {
  const view = render(<Progress value={60}><ProgressLabel>导入进度</ProgressLabel></Progress>);
  const indicator = view.container.querySelector<HTMLElement>('[data-slot="progress-indicator"]')!;
  expect(indicator.style.width).toBe("60%");
  view.rerender(<Progress value={null}><ProgressLabel>导入进度</ProgressLabel></Progress>);
  const progress = screen.getByRole("progressbar", { name: "导入进度" });
  expect(progress.hasAttribute("aria-valuenow")).toBe(false);
  expect(indicator.hasAttribute("data-indeterminate")).toBe(true);
  const width = Number.parseFloat(getComputedStyle(indicator).width);
  expect(width).toBeGreaterThan(0);
  expect(width).toBeLessThan(100);
  view.rerender(<Progress value={0}><ProgressLabel>导入进度</ProgressLabel></Progress>);
  expect(indicator.hasAttribute("data-indeterminate")).toBe(false);
  expect(indicator.style.width).toBe("0%");
});

it("disables the indeterminate animation under reduced motion", () => {
  const view = render(<Progress value={null} aria-label="正在导入" />);
  const indicator = view.container.querySelector('[data-slot="progress-indicator"]')!;
  const reduce = Array.from(style.sheet!.cssRules).find(rule =>
    "conditionText" in rule && String(rule.conditionText).includes("prefers-reduced-motion: reduce"),
  ) as CSSMediaRule;
  const matching = Array.from(reduce.cssRules).filter((rule): rule is CSSStyleRule =>
    "selectorText" in rule && indicator.matches(String(rule.selectorText)),
  );
  expect(matching.some(rule => rule.style.getPropertyValue("animation") === "none")).toBe(true);
});
