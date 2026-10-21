import { expect, test } from "vitest";
import { commands } from "vitest/browser";

for (const id of ["components-button", "component-docs-template"] as const) {
  for (const width of [320, 390] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const offline of [false, true]) {
        test(`${id} ${width}px ${theme}: ${offline ? "offline fallback" : "delayed local font loading"}`, async () => {
          const result = await commands.verifyDocsFont({ id, width, theme, offline });
          expect(result.states).toBe(3);
          expect(result.subsets).toBeGreaterThan(1);
          if (!offline) expect(result.fontBytes).toBeGreaterThan(0);
        }, 60000);
      }
    }
  }
}

test("explicit existing font choice overrides the Storybook default and does not request Noto Sans SC", async () => {
  const result = await commands.verifyDocsFont({ id: "component-docs-template", width: 390, theme: "light", offline: false, font: "geist" });
  expect(result.subsets).toBe(0);
}, 60000);

const components = {
  dialog: "default", "dropdown-menu": "default", input: "editable", popover: "default", select: "keyboard-selection",
  sheet: "right", switch: "keyboard", tabs: "default", textarea: "editable", tooltip: "hover",
};

for (const [component, story] of Object.entries(components)) {
  for (const width of [320, 390] as const) {
    for (const theme of ["light", "dark"] as const) {
      for (const offline of [false, true]) {
        test(`${component} Docs + embedded + standalone ${width}px ${theme}: ${offline ? "offline fallback" : "delayed local font loading"}`, async () => {
          const result = await commands.verifyComponentFont({ id: `components-${component}`, story, width, theme, offline });
          expect(result.states).toBe(3);
          expect(result.subsets).toBeGreaterThan(0);
        }, 60000);
      }
    }
  }
}

test("standard Docs and standalone examples honor an explicit existing font choice", async () => {
  const result = await commands.verifyComponentFont({ id: "components-input", story: "editable", width: 390, theme: "dark", offline: false, font: "geist" });
  expect(result.subsets).toBe(0);
}, 60000);
