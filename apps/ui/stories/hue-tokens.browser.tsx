import "../.storybook/preview.css";
import "../src/tag-colors.css";
import "../src/import-layout.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Check } from "lucide-react";
import { Badge } from "../src/components/ui/badge";
import TagPill from "../src/TagPill";
import { readIOSPalette } from "../src/lib/ios-palette";
import { colorPixel, contrastRatio, measurePair } from "./foundation-color-contrast";

const root = document.documentElement;
const attributes = ["class", "data-palette", "data-neutral-palette", "style"];
let original: (string | null)[];
beforeEach(() => { original = attributes.map(name => root.getAttribute(name)); });
afterEach(() => {
  cleanup();
  attributes.forEach((name, index) => {
    const value = original[index];
    if (value === null) root.removeAttribute(name); else root.setAttribute(name, value);
  });
});
const hues = [
  ["blue", "bg-blue-subtle border-blue-ring text-blue-vivid", "text-blue-icon"],
  ["cyan", "bg-cyan-subtle border-cyan-ring text-cyan-vivid", "text-cyan-icon"],
  ["gray", "bg-gray-subtle border-gray-ring text-gray-vivid", "text-gray-icon"],
  ["green", "bg-green-subtle border-green-ring text-green-vivid", "text-green-icon"],
  ["orange", "bg-orange-subtle border-orange-ring text-orange-vivid", "text-orange-icon"],
  ["pink", "bg-pink-subtle border-pink-ring text-pink-vivid", "text-pink-icon"],
  ["purple", "bg-purple-subtle border-purple-ring text-purple-vivid", "text-purple-icon"],
  ["red", "bg-red-subtle border-red-ring text-red-vivid", "text-red-icon"],
  ["teal", "bg-teal-subtle border-teal-ring text-teal-vivid", "text-teal-icon"],
  ["yellow", "bg-yellow-subtle border-yellow-ring text-yellow-vivid", "text-yellow-icon"],
  ["brown", "bg-brown-subtle border-brown-ring text-brown-vivid", "text-brown-icon"],
] as const;
// Independent defaults retained from the Tag token definitions before migration.
const tagColors = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const tagDefaults = {
  light: ["var(--color-zinc-800)", "#64473a", "var(--color-orange-800)", "color-mix(in oklab, var(--color-yellow-700) 92%, var(--color-black))", "var(--color-emerald-800)", "var(--color-blue-800)", "var(--color-violet-800)", "var(--color-pink-800)", "var(--color-red-800)"],
  dark: ["var(--color-zinc-200)", "#d7b5a0", "var(--color-orange-200)", "var(--color-yellow-200)", "var(--color-emerald-200)", "var(--color-blue-200)", "var(--color-violet-200)", "var(--color-pink-200)", "var(--color-red-200)"],
};
for (const mode of ["light", "dark"] as const) for (const neutral of ["neutral", "slate"]) {
  test(`public hues, Tag appearance and native samples: ${mode} / ${neutral}`, () => {
    root.classList.toggle("dark", mode === "dark");
    root.dataset.neutralPalette = neutral;
    const view = render(<div className="bg-body">
      {hues.map(([hue, classes, icon]) => <Badge key={hue} variant="outline" className={classes} data-testid={hue}><Check className={icon} />{hue}</Badge>)}
      {tagColors.map((color, index) => <div key={color}>
        <TagPill name={color} className={`note-tag-color-${color === "gray" ? "default" : color}`} data-testid={`tag-${color}`} />
        <span data-testid={`old-${color}`} style={{ color: tagDefaults[mode][index], backgroundColor: `color-mix(in oklab, ${tagDefaults[mode][index]} ${mode === "dark" ? 16 : 8}%, transparent)` }} />
      </div>)}
      <Badge data-testid="error" className="bg-error-inverted text-on-error">Error</Badge>
      <Badge data-testid="dark" className="bg-black text-on-dark">Dark</Badge>
      <Badge data-testid="light" className="bg-white text-on-light">Light</Badge>
      {hues.map(([hue]) => <span key={hue} data-testid={`role-${hue}`} style={{ backgroundColor: `var(--color-background-${hue})`, borderColor: `var(--color-border-${hue})`, color: `var(--color-text-${hue})`, outlineColor: `var(--color-icon-${hue})` }} />)}
    </div>);
    for (const [hue] of hues) {
      const badge = view.getByTestId(hue), style = getComputedStyle(badge), role = getComputedStyle(view.getByTestId(`role-${hue}`));
      for (const property of ["backgroundColor", "color", "borderColor"] as const) expect(style[property], `${hue} ${property}`).toBe(role[property]);
      const pair = measurePair(badge);
      expect(pair.ratio, `${hue} text`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colorPixel(style.borderColor), pair.background), `${hue} border`).toBeGreaterThanOrEqual(3);
      const icon = getComputedStyle(badge.querySelector("svg")!).color;
      expect(icon, `${hue} icon role`).toBe(role.outlineColor);
      expect(contrastRatio(colorPixel(icon), pair.background), `${hue} icon`).toBeGreaterThanOrEqual(3);
    }
    const native = readIOSPalette()!;
    for (const color of tagColors) {
      const actual = getComputedStyle(view.getByTestId(`tag-${color}`)), old = getComputedStyle(view.getByTestId(`old-${color}`));
      expect(colorPixel(actual.color), `${color} text`).toEqual(colorPixel(old.color));
      expect(colorPixel(actual.backgroundColor), `${color} fill`).toEqual(colorPixel(old.backgroundColor));
      const key = color === "gray" ? "default" : color;
      expect(native[`tag-${key}-fg`]).toEqual(colorPixel(old.color));
      expect(native[`tag-${key}-bg`]).toEqual(colorPixel(old.backgroundColor));
    }
    for (const id of ["error", "dark", "light"]) expect(measurePair(view.getByTestId(id)).ratio, id).toBeGreaterThanOrEqual(4.5);
  });
}

test("hue roles override independently and preserve Callout component colors", async () => {
  root.style.setProperty("--color-background-blue", "rgb(231 241 251)");
  root.style.setProperty("--color-border-blue", "rgb(11 22 33)");
  root.style.setProperty("--color-text-blue", "rgb(44 55 66)");
  root.style.setProperty("--color-icon-blue", "rgb(77 88 99)");
  const view = render(<>
    <Badge variant="outline" data-testid="blue" className="bg-blue-subtle border-blue-ring text-blue-vivid"><Check className="text-blue-icon" />Blue</Badge>
    <TagPill name="blue" className="note-tag-color-blue" data-testid="tag" />
    <div className="typeset"><aside data-callout="blue" data-callout-text-color="blue" data-testid="callout">Callout</aside></div>
    <span data-testid="callout-role" style={{ color: "var(--callout-text-blue)", backgroundColor: "var(--callout-background-blue)" }} />
  </>);
  const badge = getComputedStyle(view.getByTestId("blue"));
  expect(badge.backgroundColor).toBe("rgb(231, 241, 251)");
  expect(badge.borderColor).toBe("rgb(11, 22, 33)");
  expect(badge.color).toBe("rgb(44, 55, 66)");
  expect(getComputedStyle(view.getByTestId("blue").querySelector("svg")!).color).toBe("rgb(77, 88, 99)");
  expect(getComputedStyle(view.getByTestId("tag")).color).toBe(badge.color);
  expect(readIOSPalette()!["tag-blue-fg"]).toEqual([44, 55, 66, 255]);
  const callout = view.getByTestId("callout"), role = getComputedStyle(view.getByTestId("callout-role"));
  expect(getComputedStyle(callout).color).toBe(role.color);
  expect(getComputedStyle(callout).backgroundColor).toBe(role.backgroundColor);
  root.style.setProperty("--tag-blue-fg", "rgb(121 122 123)");
  root.style.setProperty("--callout-text-blue", "rgb(151 152 153)");
  await expect.poll(() => getComputedStyle(view.getByTestId("tag")).color).toBe("rgb(121, 122, 123)");
  expect(getComputedStyle(callout).color).toBe("rgb(151, 152, 153)");
  callout.style.setProperty("--color-text-blue", "rgb(181 182 183)");
  expect(getComputedStyle(callout).color).toBe("rgb(181, 182, 183)");
});
