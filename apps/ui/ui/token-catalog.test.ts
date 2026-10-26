// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { aliases, tokens } from "./token-catalog";

vi.mock("./theme.css?raw", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: readFileSync(new URL("./theme.css", import.meta.url), "utf8") };
});

it("retains the stored Luma sidebar surface independently from body, card and muted roles", () => {
  const registry = JSON.parse(readFileSync(new URL("../../../design/themes/ui-luma.registry.json", import.meta.url), "utf8"));
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

it.each([
  { name: "--shadow-low", light: [["0 4px 12px -4px", 4], ["0 1px 2px", 2]], dark: [["0 2px 4px -1px", 16]], interfaces: ["shadow-sm"] },
  { name: "--shadow-med", light: [["0 12px 16px -12px", 12], ["0 2px 6px -2px", 3]], dark: [["0 4px 12px -3px", 24]], interfaces: ["shadow-med"] },
  { name: "--shadow-high", light: [["0 20px 24px -20px", 20], ["0 4px 8px -4px", 4]], dark: [["0 14px 28px -7px", 36], ["0 2px 4px -1px", 24]], interfaces: ["shadow-lg", "shadow-xl"] },
  { name: "--shadow-input-focus", light: [["0 6px 20px", 6], ["0 1px 3px", 3]], dark: [["0 6px 20px", 28], ["0 1px 3px", 18]], interfaces: ["shadow-input-focus"] },
])("keeps $name soft in both modes without embedding a surface edge", ({ name, light, dark, interfaces }) => {
  const token = tokens.find(token => token.name === name)!;
  expect(token).toMatchObject({ category: "elevation", interfaces });
  for (const [mode, layers] of [["light", light], ["dark", dark]] as const) {
    const color = name === "--shadow-input-focus" ? mode === "light" ? "--color-neutral-900" : "--color-black" : "--color-shadow";
    expect(token[mode]).toBe(layers.map(([geometry, opacity]) => `${geometry} color-mix(in srgb, var(${color}) ${opacity}%, transparent)`).join(", "));
    expect(token[mode]).not.toContain("inset");
    const blurs = [...token[mode].matchAll(/(?:^|, )0 \d+px (\d+)px(?: -?\d+(?:\.\d+)?px)? color-mix/g)].map(match => Number(match[1]));
    expect(blurs).toHaveLength(layers.length);
    expect(blurs.every(blur => blur > 0)).toBe(true);
  }
});

it("keeps border roles independent from shadows and preserves utility aliases", () => {
  expect(tokens.find(token => token.name === "--color-shadow")).toMatchObject({ light: "rgb(25 25 25)", dark: "var(--color-black)", valueSource: "project" });
  expect(tokens.find(token => token.name === "--color-border")).toMatchObject({
    light: "color-mix(in srgb, var(--color-black) 8%, transparent)",
    dark: "color-mix(in srgb, var(--color-white) 10%, transparent)",
    category: "colors", colorGroup: "colors", projectExtension: false, valueSource: undefined, interfaces: ["border-border"],
  });
  expect(tokens.find(token => token.name === "--color-divider")).toMatchObject({ light: "var(--color-border)", dark: "var(--color-border)" });
  expect(tokens.find(token => token.name === "--color-border-subtle")).toMatchObject({
    light: "color-mix(in srgb, var(--color-black) 6%, transparent)",
    dark: "color-mix(in srgb, var(--color-white) 5%, transparent)",
    category: "colors", colorGroup: "extensions", projectExtension: true, interfaces: ["border-border-subtle"],
  });
  expect(tokens.find(token => token.name === "--color-border-elevated")).toBeUndefined();
  expect(aliases.find(alias => alias.name === "--color-border-elevated")).toBeUndefined();
  expect(tokens.flatMap(token => token.interfaces)).not.toContain("border-border-elevated");
  expect(aliases).toEqual(expect.arrayContaining([
    { name: "--shadow-sm", value: "var(--shadow-low)" },
    { name: "--shadow-med", value: "var(--shadow-med)" },
    { name: "--shadow-md", value: "initial" },
    { name: "--shadow-lg", value: "var(--shadow-high)" },
    { name: "--shadow-xl", value: "var(--shadow-high)" },
    { name: "--shadow-card-hover", value: "var(--shadow-card-hover)" },
    { name: "--shadow-input-focus", value: "var(--shadow-input-focus)" },
    { name: "--color-border", value: "var(--color-border)" },
    { name: "--color-border-subtle", value: "var(--color-border-subtle)" },
    ...["hover", "selected", "success", "warning", "error"].map(state => ({ name: `--shadow-inset-${state}`, value: `var(--shadow-inset-${state})` })),
  ]));
});
