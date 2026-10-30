// @vitest-environment node
import { expect, it, vi } from "vitest";
import { aliases, tokens } from "./token-catalog";

vi.mock("./theme.css?raw", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: readFileSync(new URL("./theme.css", import.meta.url), "utf8") };
});

it("keeps sidebar, page and content surfaces mapped to their own semantic roles", () => {
  const sidebar = tokens.find(token => token.name === "--color-background-sidebar")!;
  expect(sidebar).toMatchObject({ category: "colors", colorGroup: "extensions", projectExtension: true, interfaces: ["bg-sidebar"] });
  expect(sidebar).toMatchObject({ light: "var(--color-neutral-100)", dark: "var(--color-neutral-900)" });
  expect(tokens.find(token => token.name === "--color-background-body")).toMatchObject({ light: "var(--color-neutral-100)", dark: "var(--color-neutral-950)" });
  expect(tokens.find(token => token.name === "--color-background-surface")).toMatchObject({ light: "var(--color-white)", dark: "var(--color-neutral-900)" });
  expect(tokens.find(token => token.name === "--color-background-muted")).toMatchObject({ light: "var(--color-neutral-100)", dark: "var(--color-neutral-800)" });
});

const shadowScale = tokens.filter(token => token.name.startsWith("--shadow-scale-"));
const outlinedScale = tokens.filter(token => token.name.startsWith("--shadow-outlined-"));

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

it("shares Figma projection geometry across themes and strengthens dark opacity fourfold", () => {
  const lightLayers = [
    Array.from({ length: 6 }, () => [0, 0, 0, 0, 0]),
    [[0, 2, 4, 0, 4], [0, 1, 2, -1, 2]],
    [[0, 16, 32, -16, 12], [0, 4, 8, -4, 4]],
    [[0, 20, 30, -20, 24], [0, 8, 16, -8, 4], [0, 4, 8, -4, 4]],
    [[0, 24, 36, 0, 4], [0, 16, 24, 0, 8], [0, 4, 8, -4, 4]],
  ];
  const darkOpacity = [[0, 0, 0, 0, 0, 0], [16, 8], [48, 16], [96, 16, 16], [16, 32, 16]];
  const previousHeight = { light: 0, dark: 0 };
  for (const [index, token] of shadowScale.entries()) {
    const light = outerLayers(token.light);
    const dark = outerLayers(token.dark);
    expect(light).toEqual(lightLayers[index].map(([x, y, blur, spread, opacity]) => ({ geometry: [x, y, blur, spread], opacity })));
    expect(dark.map(layer => layer.opacity)).toEqual(darkOpacity[index]);
    expect(dark.map(layer => layer.geometry)).toEqual(light.map(layer => layer.geometry));
    for (const [mode, layers] of [["light", light], ["dark", dark]] as const) {
      if (index === 0) expect(layers.every(layer => layer.geometry.every(value => value === 0))).toBe(true);
      else {
        const height = Math.max(...layers.filter(layer => layer.opacity > 0).map(layer => layer.geometry[1] + layer.geometry[2]));
        expect(height).toBeGreaterThan(previousHeight[mode]);
        previousHeight[mode] = height;
      }
    }
  }
});

it("composes five outlined recipes from the same projections and exactly one independent edge", () => {
  expect(outlinedScale.map(token => token.name)).toEqual([0, 1, 2, 3, 4].map(level => `--shadow-outlined-${level}`));
  expect(tokens.find(token => token.name === "--shadow-edge")).toMatchObject({
    light: "0px 0px 0px 1px color-mix(in srgb, var(--color-shadow) 4%, transparent)",
    dark: "0px 0px 0px 1px color-mix(in srgb, var(--color-white) 8%, transparent)",
    interfaces: [],
  });
  for (const [level, token] of outlinedScale.entries()) {
    const value = level === 0 ? "var(--shadow-edge)" : `var(--shadow-scale-${level}), var(--shadow-edge)`;
    expect(token).toMatchObject({ light: value, dark: value, category: "elevation", interfaces: [] });
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
  ["low", "var(--shadow-outlined-2)", ["shadow-low"]],
  ["med", "var(--shadow-outlined-3)", ["shadow-med"]],
  ["high", "var(--shadow-outlined-4)", ["shadow-high"]],
  ["control", "var(--shadow-outlined-1), var(--surface-highlight-control)", ["shadow-control"]],
  ["floating", "var(--shadow-outlined-2)", ["shadow-floating"]],
  ["document", "var(--shadow-outlined-3)", ["shadow-document"]],
  ["card-hover", "var(--shadow-scale-2)", ["shadow-card-hover"]],
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
  expect(tokens.find(token => token.name === "--color-divider")).toMatchObject({ light: "color-mix(in srgb, var(--color-black) 6%, transparent)", dark: "var(--color-border)" });
  expect(tokens.find(token => token.name === "--color-border-subtle")).toMatchObject({
    light: "color-mix(in srgb, var(--color-black) 4%, transparent)",
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
  expect(tokens.find(token => token.name === "--shadow-high")).toMatchObject({ light: "var(--shadow-outlined-4)", dark: "var(--shadow-outlined-4)" });
});
