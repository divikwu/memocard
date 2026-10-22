import { expect, test } from "vitest";
import { commands } from "vitest/browser";
import { catalog, foundationPages } from "./foundation-reference.data";

for (const width of [320, 390, 1368] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`Foundation Docs ${width}px ${theme}: values, definitions, anchors and layout`, async () => {
      const result = await commands.verifyFoundationReference({ width, theme, palette: width === 390 ? "blue" : "mono" });
      expect(result.definitions).toBe(catalog.css.filter(token => token.layer !== "adapter").length);
      expect(result.sections).toBe(foundationPages.all.sections.length);
    }, 60000);
  }
}
