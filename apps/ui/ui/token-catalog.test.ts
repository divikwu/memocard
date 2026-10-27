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

const shadowScale = [
  { name: "xxs", geometry: ["0px 1px 1.5px 0px", "0px 2.5px 4px 0px"], light: [4.5, 4.5], dark: [14, 16] },
  { name: "xs", geometry: ["0px 1px 1px 0px", "0px 3px 3px 0px", "0px 6px 4px 0px", "0px 11px 4px 0px", "0px 17px 5px 0px"], light: [3, 3, 1.5, 0.75, 0], dark: [8, 7, 4, 1, 0] },
  { name: "sm", geometry: ["0px 2px 4px 0px", "0px 8px 8px 0px", "0px 18px 11px 0px", "0px 32px 13px 0px", "0px 51px 14px 0px"], light: [5.25, 4.5, 3, 0.75, 0], dark: [10, 9, 5, 1, 0] },
  { name: "md", geometry: ["0px 4px 9px 0px", "0px 16px 16px 0px", "0px 36px 22px 0px", "0px 65px 26px 0px", "0px 101px 28px 0px"], light: [5.25, 4.5, 3, 0.75, 0], dark: [12, 10, 6, 2, 0] },
  { name: "sr", geometry: ["0px 1px 2px 0px", "0px 4px 4px 0px", "0px 9px 5px 0px", "0px 16px 6px 0px", "0px 25px 7px 0px"], light: [3.75, 3, 2.25, 0.75, 0], dark: [9, 8, 5, 1, 0] },
  { name: "doc", geometry: ["0px 1px 1px -.5px", "0px 3px 3px -1.5px", "0px 6px 6px -3px", "0px 12px 12px -6px", "0px 24px 24px -12px"], light: [4.5, 4.5, 4.5, 3, 2.25], dark: [10, 10, 10, 8, 8] },
];

it.each(shadowScale)("keeps $name geometry with softer light opacity and unchanged Craft dark opacity", ({ name, geometry, light, dark }) => {
  const token = tokens.find(token => token.name === `--shadow-scale-${name}`)!;
  expect(token.category).toBe("elevation");
  for (const mode of ["light", "dark"] as const) {
    const opacity = mode === "light" ? light : dark;
    expect(token[mode]).toBe(geometry.map((layer, i) => `${layer} color-mix(in srgb, var(--color-shadow) ${opacity[i]}%, transparent)`).join(", "));
    expect(token[mode]).not.toMatch(/0px 0px 0px 1px/);
    expect(token[mode]).not.toContain("inset");
  }
});

it("exposes all eight scale levels and keeps transparent transitions and optional inner highlights", () => {
  expect(tokens.filter(token => token.name.startsWith("--shadow-scale-")).map(token => token.name)).toEqual([
    "--shadow-scale-empty", "--shadow-scale-xxs", "--shadow-scale-xs", "--shadow-scale-sm",
    "--shadow-scale-md", "--shadow-scale-sr", "--shadow-scale-doc", "--shadow-scale-inner",
  ]);
  const empty = Array(6).fill("0px 0px 0px 0px color-mix(in srgb, var(--color-shadow) 0%, transparent)").join(", ");
  expect(tokens.find(token => token.name === "--shadow-scale-empty")).toMatchObject({ light: empty, dark: empty });
  expect(tokens.find(token => token.name === "--shadow-scale-inner")).toMatchObject({
    light: "inset color-mix(in srgb, var(--color-white) 88%, transparent) 0px 0px 0px 1px",
    dark: "inset color-mix(in srgb, var(--color-white) 4%, transparent) 0px 0px 0px 1px",
  });
});

it.each([
  ["low", "var(--shadow-scale-xs)", ["shadow-sm"]],
  ["med", "var(--shadow-scale-sm)", ["shadow-med"]],
  ["high", "var(--shadow-scale-md)", ["shadow-lg", "shadow-xl", "surface-floating"]],
  ["control", "var(--shadow-scale-xxs), var(--shadow-scale-inner)", ["shadow-control"]],
  ["floating", "var(--shadow-scale-sr)", ["shadow-floating"]],
  ["document", "var(--shadow-scale-doc)", ["shadow-document"]],
  ["input-focus", "var(--shadow-med)", ["shadow-input-focus"]],
])("maps %s to a component role in both themes", (name, value, interfaces) => {
  expect(tokens.find(token => token.name === `--shadow-${name}`)).toMatchObject({ light: value, dark: value, category: "elevation", interfaces });
});

it("keeps the independent card hover shadow visible in both modes", () => {
  expect(tokens.find(token => token.name === "--shadow-card-hover")).toMatchObject({
    light: "0 10px 20px color-mix(in srgb, var(--color-shadow) 3%, transparent)",
    dark: "0 10px 20px color-mix(in srgb, var(--color-shadow) 12%, transparent)",
  });
});

it("keeps border roles independent from shadows and preserves utility aliases", () => {
  expect(tokens.find(token => token.name === "--color-shadow")).toMatchObject({ light: "var(--color-black)", dark: "var(--color-black)", valueSource: "project" });
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

it("limits Craft decorative edges to floating surfaces without changing shared borders or elevation", () => {
  expect(tokens.find(token => token.name === "--color-border-floating")).toMatchObject({
    light: "var(--color-border)", dark: "transparent", projectExtension: true,
  });
  expect(tokens.find(token => token.name === "--surface-edge-floating")).toMatchObject({
    light: "0 0 0 0 transparent, inset 0 0 0 0 transparent",
    dark: "0 0 0 var(--border-width) color-mix(in srgb, var(--color-black) 12%, transparent), inset 0 0 0 var(--border-width) color-mix(in srgb, var(--color-white) 4%, transparent)",
    category: "elevation",
  });
  expect(tokens.find(token => token.name === "--shadow-high")).toMatchObject({ light: "var(--shadow-scale-md)", dark: "var(--shadow-scale-md)" });
});
