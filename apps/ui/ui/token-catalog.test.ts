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

const shadowScale = tokens.filter(token => token.name.startsWith("--shadow-scale-"));

function outerLayers(value: string) {
  const matches = [...value.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px (-?[\d.]+)px color-mix\(in srgb, var\(--color-shadow\) ([\d.]+)%, transparent\)/g)];
  expect(matches.map(match => match[0]).join(", ")).toBe(value);
  return matches.map(([, x, y, blur, spread, opacity]) => ({ geometry: [x, y, blur, spread].map(Number), opacity: Number(opacity) }));
}

it("exposes only five ordered outer-shadow levels without primitive utility interfaces", () => {
  expect(shadowScale.map(token => token.name)).toEqual([0, 1, 2, 3, 4].map(level => `--shadow-scale-${level}`));
  for (const token of shadowScale) {
    expect(token.category).toBe("elevation");
    expect(token.interfaces).toEqual([]);
    expect(token.light).not.toContain("inset");
    expect(token.dark).not.toContain("inset");
  }
});

it("keeps multi-layer geometry and a single outer edge consistent across themes", () => {
  const lightOpacity = [[0, 0, 0, 0, 0, 0], [4, 6, 6], [4, 4, 2, 1, 0, 6], [7, 6, 4, 1, 0, 6], [7, 6, 4, 1, 0, 3]];
  const darkOpacity = [[0, 0, 0, 0, 0, 0], [12, 14, 16], [8, 7, 4, 1, 0, 12], [10, 9, 5, 1, 0, 12], [12, 10, 6, 2, 0, 12]];
  let previousHeight = 0;
  for (const [index, token] of shadowScale.entries()) {
    const light = outerLayers(token.light);
    const dark = outerLayers(token.dark);
    expect(light).toHaveLength(index === 1 ? 3 : 6);
    expect(dark.map(layer => layer.geometry)).toEqual(light.map(layer => layer.geometry));
    expect(light.map(layer => layer.opacity)).toEqual(lightOpacity[index]);
    expect(dark.map(layer => layer.opacity)).toEqual(darkOpacity[index]);
    const edges = light.filter(layer => layer.geometry[3] === 1);
    expect(edges).toHaveLength(index === 0 ? 0 : 1);
    for (const edge of edges) expect(edge.geometry).toEqual([0, 0, 0, 1]);
    if (index === 0) {
      expect(light.every(layer => layer.geometry.every(value => value === 0))).toBe(true);
    } else {
      const height = Math.max(...light.filter(layer => layer.opacity > 0).map(layer => layer.geometry[1] + layer.geometry[2]));
      expect(height).toBeGreaterThan(previousHeight);
      previousHeight = height;
    }
  }
});

it("owns the control highlight separately from the elevation scale", () => {
  expect(tokens.find(token => token.name === "--surface-highlight-control")).toMatchObject({
    light: "inset color-mix(in srgb, var(--color-white) 88%, transparent) 0px 0px 0px 1px",
    dark: "inset color-mix(in srgb, var(--color-white) 4%, transparent) 0px 0px 0px 1px",
    category: "elevation",
    interfaces: [],
  });
});

it.each([
  ["flat", "var(--shadow-scale-0)", ["shadow-flat"]],
  ["low", "var(--shadow-scale-2)", ["shadow-low"]],
  ["med", "var(--shadow-scale-3)", ["shadow-med"]],
  ["high", "var(--shadow-scale-4)", ["shadow-high"]],
  ["control", "var(--shadow-scale-1), var(--surface-highlight-control)", ["shadow-control"]],
  ["floating", "var(--shadow-scale-2)", ["shadow-floating"]],
  ["document", "var(--shadow-scale-3)", ["shadow-document"]],
  ["card-hover", "var(--shadow-low)", ["shadow-card-hover"]],
  ["input-focus", "var(--shadow-med)", ["shadow-input-focus"]],
])("maps %s to a component role in both themes", (name, value, interfaces) => {
  expect(tokens.find(token => token.name === `--shadow-${name}`)).toMatchObject({ light: value, dark: value, category: "elevation", interfaces });
});

it("keeps border roles independent from shadows and preserves utility aliases", () => {
  expect(tokens.find(token => token.name === "--color-shadow")).toMatchObject({ light: "var(--color-black)", dark: "var(--color-black)", valueSource: "project", interfaces: [] });
  expect(tokens.find(token => token.name === "--color-border")).toMatchObject({
    light: "color-mix(in srgb, var(--color-black) 8%, transparent)",
    dark: "color-mix(in srgb, var(--color-white) 10%, transparent)",
    category: "colors", colorGroup: "colors", projectExtension: false, valueSource: undefined, interfaces: ["border-border", "surface-floating"],
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
    { name: "--shadow-flat", value: "var(--shadow-flat)" },
    { name: "--shadow-low", value: "var(--shadow-low)" },
    { name: "--shadow-high", value: "var(--shadow-high)" },
    { name: "--shadow-med", value: "var(--shadow-med)" },
    { name: "--shadow-card-hover", value: "var(--shadow-card-hover)" },
    { name: "--shadow-input-focus", value: "var(--shadow-input-focus)" },
    { name: "--color-border", value: "var(--color-border)" },
    { name: "--color-border-subtle", value: "var(--color-border-subtle)" },
  ]));
});

it("keeps reserved state feedback outside the public shadow utility API", () => {
  const reserved = tokens.filter(token => token.name.startsWith("--shadow-inset-"));
  expect(reserved).toHaveLength(5);
  for (const token of reserved) {
    expect(token.interfaces).toEqual([]);
    expect(aliases.find(alias => alias.name === token.name)).toBeUndefined();
  }
});

it("does not duplicate the elevation edge in floating borders or highlights", () => {
  expect(tokens.find(token => token.name === "--color-border-floating")).toMatchObject({
    light: "transparent", dark: "transparent", projectExtension: true,
  });
  expect(tokens.find(token => token.name === "--surface-edge-floating")).toMatchObject({
    light: "0 0 0 0 transparent, inset 0 0 0 0 transparent",
    dark: "0 0 0 0 transparent, inset 0 0 0 var(--border-width) color-mix(in srgb, var(--color-white) 4%, transparent)",
    category: "elevation",
  });
  expect(tokens.find(token => token.name === "--shadow-high")).toMatchObject({ light: "var(--shadow-scale-4)", dark: "var(--shadow-scale-4)" });
});
