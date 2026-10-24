import { expect, test } from "vitest";
import { defineTheme, type DefineThemeInput } from "./define-theme";
import { generateThemeColor } from "./generate-theme-color";
import { contrastRatio } from "./color-math";
import { fontSizes, textStyles, lineHeight } from "../typography/scale";

const invalid = (input: unknown) => defineTheme(input as DefineThemeInput);
test("empty themes preserve defaults; inheritance flattens and explicit values win", () => {
  expect(defineTheme({ name: "empty" }).cssText).toBe("");
  const base = defineTheme({ name: "base", color: { accent: "#0064E0" }, radius: { base: 10 }, tokens: { "--radius": "12px" }, localTokens: { "--brand": ["red", "blue"] } });
  const inherited = defineTheme({ name: "inherited", extends: base });
  expect(inherited.tokens).toEqual(base.tokens);
  const child = defineTheme({ name: "child", extends: base, radius: { base: 16 }, tokens: { "--primary": ["#123456", "#abcdef"] } });
  expect(child.tokens["--radius"]).toEqual(["16px", "16px"]);
  expect(child.tokens["--primary"]).toEqual(["#123456", "#abcdef"]);
  expect(child.cssText).not.toContain('theme="base"');
  expect(child.cssText).toContain(':root.dark[data-memocard-theme="child"]');
  expect(child.localTokens).toEqual(base.localTokens);
  expect(base.tokens["--radius"]).toEqual(["12px", "12px"]);
});
test("partial axes retain inherited seeds and syntax values merge below explicit tokens", () => {
  const base = defineTheme({ name: "base", color: { accent: "#AE3260", neutralStyle: "warm" }, syntax: { comment: "#888888", keyword: "#123456" } });
  const child = defineTheme({ name: "child", extends: base, color: { contrast: "high", accent: undefined, neutralStyle: undefined }, syntax: { keyword: "#aabbcc" }, tokens: { "--syntax-keyword": "#112233" } });
  expect(child.axes.color).toEqual({ accent: "#AE3260", neutralStyle: "warm", contrast: "high" });
  expect(child.tokens["--syntax-comment"]).toEqual(["#888888", "#888888"]);
  expect(child.tokens["--syntax-keyword"]).toEqual(["#112233", "#112233"]);
  expect(child.tokens["--primary"]).toEqual(base.tokens["--primary"]);
});
test("definitions isolate input arrays and cannot mutate their base axes", () => {
  const seed: [string, string] = ["#0064E0", "#48CAE4"];
  const theme = defineTheme({ name: "immutable", color: { accent: seed } });
  seed[0] = "#ff0000";
  expect(theme.axes.color?.accent?.[0]).not.toBe("#ff0000");
  expect(Object.isFrozen(theme.axes.color)).toBe(true);
  expect(Object.isFrozen(theme.tokens)).toBe(true);
});
test("base-16 typography and scale-one motion retain MemoCard's published values", () => {
  const theme = defineTheme({ name: "baseline", typography: { scale: { base: 16 } }, motion: { scale: 1 } });
  for (const [name, rem] of Object.entries(fontSizes)) {
    expect(theme.tokens[`--font-size-${name}` as keyof typeof theme.tokens]).toEqual([`${rem}rem`, `${rem}rem`]);
    expect(theme.tokens[`--line-height-${name}` as keyof typeof theme.tokens]).toEqual([String(lineHeight(name as keyof typeof fontSizes).ratio), String(lineHeight(name as keyof typeof fontSizes).ratio)]);
  }
  for (const [name, style] of Object.entries(textStyles)) expect(theme.tokens[`--text-${name}-leading` as keyof typeof theme.tokens]?.[0]).toBe(String(lineHeight(style.size, style.leading).ratio));
  expect(theme.tokens["--motion-duration-fast"]).toEqual(["150ms", "150ms"]);
  expect(theme.tokens["--motion-duration-pulse"]).toEqual(["2s", "2s"]);
  expect(theme.tokens).not.toHaveProperty("--motion-duration-reduced");
});
test("custom numeric axes generate usable CSS while formulas remain owned by core", () => {
  const theme = defineTheme({ name: "custom", typography: { scale: { base: 18, ratio: 1.25 }, body: { family: "Example Sans", fallbacks: "sans-serif" }, code: { family: "Menlo", fallbacks: "monospace" } }, radius: { base: 8, multiplier: 1.5 }, motion: { scale: .5 } });
  expect(theme.tokens["--font-size-base"]).toEqual(["1.125rem", "1.125rem"]);
  expect(theme.tokens["--radius"]).toEqual(["12px", "12px"]);
  expect(theme.tokens["--motion-duration-fast"]).toEqual(["75ms", "75ms"]);
  expect(theme.tokens["--app-font-heading"]).toEqual(theme.tokens["--app-font-body"]);
  expect(theme.tokens["--app-font-mono"]).toEqual(['"Menlo", monospace', '"Menlo", monospace']);
  expect(theme.tokens["--note-mono-font"]).toEqual(theme.tokens["--app-font-mono"]);
  expect(theme.tokens).not.toHaveProperty("--radius-sm");
});
test("neutral-only generation does not overwrite the current accent", () => {
  const tokens = generateThemeColor({ neutralStyle: "warm" });
  for (const key of ["--primary", "--primary-foreground", "--accent-500", "--text-accent-color", "--accent-text"]) expect(tokens).not.toHaveProperty(key);
});
for (const seed of ["#0064E0", "#48CAE4", "#FFFFFF", "#000000", "#FFFF00", "#00FF00", "#FF00FF"]) for (const contrast of ["standard", "high"] as const) test(`generated color contrast: ${seed} / ${contrast}`, () => {
  const tokens = generateThemeColor({ accent: seed, neutralStyle: "warm", contrast });
  for (const mode of [0, 1]) {
    const value = (name: string) => (tokens[name] as readonly string[])[mode];
    expect(contrastRatio(value("--primary"), value("--primary-foreground"))).toBeGreaterThanOrEqual(4.5);
    for (const surface of ["--background", "--card", "--popover", "--surface-bg", "--muted"]) {
      expect(contrastRatio(value("--foreground"), value(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(value("--muted-foreground"), value(surface))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(value("--border-emphasized-color"), value(surface))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(value("--focus-outline-color"), value(surface))).toBeGreaterThanOrEqual(3);
    }
  }
});
test("rejects malformed definitions, unsupported fields and unwritable adapter keys", () => {
  for (const input of [null, [], { name: null }, { name: "bad\"name" }, { name: "a", extends: undefined }, { name: "a", extends: {} }, { name: "a", icons: {} }, { name: "a", tokens: null }, { name: "a", tokens: { "--unknown": "red" } }, { name: "a", tokens: { "--color-accent-bg": "red" } }, { name: "a", tokens: { "--primary": ["red"] } }, { name: "a", tokens: { "--primary": "red; color:blue" } }, { name: "a", radius: { base: -1 } }, { name: "a", motion: { scale: Infinity } }, { name: "a", typography: { scale: null } }, { name: "a", typography: { body: null } }, { name: "a", color: { accent: "blue" } }, { name: "a", color: { neutralStyle: "" } }, { name: "a", localTokens: { "--primary": "red" } }]) expect(() => invalid(input), JSON.stringify(input)).toThrow();
});
test("rejects unknown references and cycles through explicit, local and existing defaults", () => {
  for (const input of [
    { name: "a", tokens: { "--primary": "var(--missing)" } },
    { name: "a", tokens: { "--primary": "var(--foreground)", "--foreground": "var(--primary)" } },
    { name: "a", tokens: { "--primary": "var(--accent-muted-bg)" } },
    { name: "a", localTokens: { "--brand-a": "var(--brand-b)", "--brand-b": "var(--brand-a)" } },
  ]) expect(() => invalid(input)).toThrow(/reference/);
  expect(defineTheme({ name: "valid", localTokens: { "--brand": "#123456" }, tokens: { "--primary": "var(--brand)" } }).tokens["--primary"]).toEqual(["var(--brand)", "var(--brand)"]);
});
