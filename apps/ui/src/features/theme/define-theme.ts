import { knownTokenNames, themeTokenDefinitions, themeTokenNames, type ThemeTokenName } from "../../generated/theme-contract.ts";
import { generateThemeValues, type ThemeAxes } from "./theme-values.ts";
import type { ThemeStyles, TokenValue } from "./theme-types.ts";

export type { ThemeTokenName, ThemeStyles, TokenValue };
export type ThemeTokens = Partial<Record<ThemeTokenName, TokenValue>>;
type Pair = readonly [string, string];
export type DefinedTheme = ThemeStyles & Readonly<{
  tokens: Readonly<Partial<Record<ThemeTokenName, Pair>>>;
  localTokens: Readonly<Record<string, Pair>>;
  axes: ThemeAxes;
}>;
export type DefineThemeInput = ThemeAxes & {
  name: string;
  extends?: DefinedTheme;
  tokens?: ThemeTokens;
  localTokens?: Record<`--${string}`, TokenValue>;
  syntax?: Partial<Record<"keyword" | "string" | "comment" | "number" | "function" | "type" | "variable" | "operator" | "constant" | "tag" | "attribute" | "property" | "punctuation" | "background" | "added" | "removed" | "diff-header" | "added-marker" | "removed-marker", TokenValue>>;
};
const definitions = new WeakSet<object>();
const targets = new Set<string>(themeTokenNames);
const known = new Set(knownTokenNames);
const references = (value: string) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
const scopes = [...new Set(Object.values(themeTokenDefinitions).flatMap(values => values.map(value => value.scope)))];

function pair(value: TokenValue, name: string): Pair {
  const values = typeof value === "string" ? [value, value] : value;
  if (!Array.isArray(values) || values.length !== 2 || values.some(value => typeof value !== "string" || !value.trim() || /[;{}<>]|\/\*|\*\/|!important/i.test(value))) throw new Error(`Invalid theme value: ${name}`);
  return Object.freeze([values[0], values[1]]);
}

function validateReferences(tokens: Record<string, Pair>) {
  for (const [name, values] of Object.entries(tokens)) for (const value of values) for (const ref of references(value)) {
    if (!known.has(ref) && !(ref in tokens)) throw new Error(`Unknown theme reference: ${name} -> ${ref}`);
  }
  // Include authored defaults/overrides, so a new alias cannot form a cycle
  // through an existing theme or palette expression.
  for (const scope of scopes) for (const mode of [0, 1]) {
    const graph = new Map(Object.entries(themeTokenDefinitions).map(([name, values]) => {
      const fallback = mode === 1 ? values.find(value => value.scope === ".dark") ?? values[0] : values[0];
      return [name, references((values.find(value => value.scope === scope) ?? fallback).value)];
    }));
    for (const [name, values] of Object.entries(tokens)) graph.set(name, references(values[mode]));
    const active = new Set<string>(), done = new Set<string>();
    function visit(name: string) {
      if (active.has(name)) throw new Error(`Cyclic theme reference: ${name}`);
      if (done.has(name) || !graph.has(name)) return;
      active.add(name);
      for (const ref of graph.get(name)!) visit(ref);
      active.delete(name); done.add(name);
    }
    for (const name of graph.keys()) visit(name);
  }
}

export function defineTheme(input: DefineThemeInput): DefinedTheme {
  if (!input || typeof input !== "object" || Array.isArray(input) || typeof input.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(input.name)) throw new Error("Theme name must be a lowercase CSS identifier.");
  for (const key of Object.keys(input)) if (!["name", "extends", "tokens", "localTokens", "syntax", "color", "typography", "radius", "motion"].includes(key)) throw new Error(`Unknown theme field: ${key}`);
  if ("extends" in input && (!input.extends || !definitions.has(input.extends))) throw new Error("Theme extends must be a result of defineTheme().");
  for (const field of ["tokens", "localTokens", "syntax"] as const) {
    const value = input[field];
    if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) throw new Error(`Invalid ${field} map.`);
  }
  const base = input.extends;
  const { axes, tokens: generated } = generateThemeValues(input, base?.axes);
  const tokens: Partial<Record<ThemeTokenName, Pair>> = { ...base?.tokens };
  const localTokens: Record<string, Pair> = { ...base?.localTokens };
  const assign = (values: Record<string, TokenValue | undefined>) => {
    for (const [name, value] of Object.entries(values)) {
      if (value === undefined) continue;
      if (!targets.has(name)) throw new Error(`Unknown theme token: ${name}. Use a canonical token, not a Tailwind adapter.`);
      tokens[name as ThemeTokenName] = pair(value, name);
    }
  };
  assign(generated);
  if (input.syntax) assign(Object.fromEntries(Object.entries(input.syntax).map(([name, value]) => [`--syntax-${name}`, value])));
  assign(input.tokens ?? {});
  for (const [name, value] of Object.entries(input.localTokens ?? {})) {
    if (!/^--[a-zA-Z_][\w-]*$/.test(name) || known.has(name)) throw new Error(`Invalid or already-owned local token: ${name}`);
    localTokens[name] = pair(value, name);
  }
  const merged = { ...tokens, ...localTokens } as Record<string, Pair>;
  validateReferences(merged);
  const entries = Object.entries(merged).sort(([a], [b]) => a.localeCompare(b, "en"));
  const selector = `:root[data-memocard-theme="${input.name}"][data-memocard-theme]`;
  const rule = (selector: string, entries: [string, Pair][], mode: number) => entries.length ? `${selector} {\n${entries.map(([name, values]) => `  ${name}: ${values[mode]};`).join("\n")}\n}\n` : "";
  const cssText = rule(selector, entries, 0) + rule(selector.replace(":root", ":root.dark"), entries.filter(([, values]) => values[0] !== values[1]), 1);
  const theme: DefinedTheme = Object.freeze({ name: input.name, cssText, tokens: Object.freeze(tokens), localTokens: Object.freeze(localTokens), axes });
  definitions.add(theme);
  return theme;
}
