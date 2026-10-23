// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { tokens } from "./token-catalog";

vi.mock("./theme.css?raw", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: readFileSync(new URL("./theme.css", import.meta.url), "utf8") };
});

it("retains the stored Luma sidebar surface independently from body, card and muted roles", () => {
  const registry = JSON.parse(readFileSync(new URL("../../../design/themes/ui-next-luma.registry.json", import.meta.url), "utf8"));
  const palette = readFileSync(new URL("../node_modules/tailwindcss/theme.css", import.meta.url), "utf8");
  const sidebar = tokens.find(token => token.name === "--color-background-sidebar")!;
  expect(sidebar).toMatchObject({ category: "colors", colorGroup: "extensions", projectExtension: true, interfaces: ["bg-sidebar"] });
  for (const mode of ["light", "dark"] as const) {
    const name = sidebar[mode].match(/^var\((--color-neutral-\d+)\)$/)![1];
    const lightness = Number(palette.match(new RegExp(`${name}: oklch\\(([\\d.]+)% 0 (?:0|none)\\)`))![1]) / 100;
    expect(registry.cssVars[mode].sidebar).toBe(`oklch(${lightness} 0 0)`);
  }
  expect(tokens.find(token => token.name === "--color-background-body")).toMatchObject({ light: "var(--color-white)", dark: "var(--color-neutral-950)" });
  expect(tokens.find(token => token.name === "--color-background-surface")).toMatchObject({ light: "var(--color-white)", dark: "var(--color-neutral-900)" });
  expect(tokens.find(token => token.name === "--color-background-muted")).toMatchObject({ light: "var(--color-neutral-100)", dark: "var(--color-neutral-800)" });
});
