import "../.storybook/preview.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DomainTokens, dataRoles, syntaxInks } from "./domain-tokens.example";
import { Markdown } from "../src/markdown";
import { RichMarkdownEditor } from "../src/RichMarkdownEditor";
import { NEUTRAL_VALUES, PALETTE_VALUES } from "../src/features/theme/preferences";
import { colorPixel, contrastRatio } from "./foundation-color-contrast";

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

function composite(...colors: string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
  for (const color of colors) { context.fillStyle = color; context.fillRect(0, 0, 1, 1); }
  return [...context.getImageData(0, 0, 1, 1).data];
}

for (const mode of ["light", "dark"]) for (const palette of PALETTE_VALUES) for (const neutral of NEUTRAL_VALUES) {
  test(`data and syntax roles: ${mode} / ${palette} / ${neutral}`, () => {
    root.classList.toggle("dark", mode === "dark");
    root.dataset.palette = palette;
    root.dataset.neutralPalette = neutral;
    const view = render(<DomainTokens />), style = getComputedStyle(root);
    expect(dataRoles).toHaveLength(56);
    expect(syntaxInks).toHaveLength(15);
    for (const [name] of dataRoles) {
      const fill = getComputedStyle(view.container.querySelector(`[data-data-role="${name}"]`)!).fill;
      expect(colorPixel(fill), name).toEqual(colorPixel(style.getPropertyValue(name)));
      expect(colorPixel(fill)[3], `${name} opacity`).toBe(255);
    }
    for (const hue of ["blue", "shamrock", "orange", "pink", "purple", "red", "teal", "yellow", "gray"]) {
      const white = [255, 255, 255];
      const contrast = [1, 2, 3, 4, 5].map(level => contrastRatio(colorPixel(style.getPropertyValue(`--data-${hue}-${level}`)), white));
      for (let index = 1; index < contrast.length; index++) expect(contrast[index], `${hue} strength ${index + 1}`).toBeGreaterThan(contrast[index - 1]);
    }
    const base = getComputedStyle(view.container.querySelector("pre")!).backgroundColor;
    expect(colorPixel(base)).toEqual(colorPixel(style.getPropertyValue("--syntax-background")));
    for (const [row, variable] of [["added", "--syntax-added"], ["removed", "--syntax-removed"], ["header", "--syntax-diff-header"]]) {
      const tint = getComputedStyle(view.container.querySelector(`[data-diff="${row}"]`)!).backgroundColor;
      expect(colorPixel(tint), `${row} background role`).toEqual(colorPixel(style.getPropertyValue(variable)));
    }
    for (const [name] of syntaxInks) {
      const ink = getComputedStyle(view.container.querySelector(`[data-syntax-role="${name}"]`)!).color;
      expect(colorPixel(ink), name).toEqual(colorPixel(style.getPropertyValue(name)));
      for (const row of [undefined, "added", "removed", "header"]) {
        const tint = row ? getComputedStyle(view.container.querySelector(`[data-diff="${row}"]`)!).backgroundColor : "transparent";
        expect(contrastRatio(colorPixel(ink), composite(base, tint)), `${name} on ${row ?? "code"}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

for (const mode of ["light", "dark"]) test(`code backgrounds preserve appearance and support overrides: ${mode}`, async () => {
  root.classList.toggle("dark", mode === "dark");
  const source = "```js\nconst answer = 42;\n```";
  const noop = () => {};
  const view = render(<>
    <div data-testid="read"><Markdown body={source} /></div>
    <div data-testid="edit"><RichMarkdownEditor value={source} onChange={noop} notePath="fixture.md" disabled={false} autoFocus={false} onSave={noop} onError={noop} /></div>
    <span data-testid="old" style={{ backgroundColor: "var(--color-muted, color-mix(in oklab, currentColor 8%, transparent))" }} />
  </>);
  await expect.poll(() => view.getByTestId("edit").querySelector("pre")).toBeTruthy();
  for (const id of ["read", "edit"]) {
    const pre = view.getByTestId(id).querySelector("pre")!;
    expect(getComputedStyle(pre).backgroundColor).toBe(getComputedStyle(view.getByTestId("old")).backgroundColor);
    expect(pre.textContent).toBe("const answer = 42;" + (id === "read" ? "\n" : ""));
  }
  root.style.setProperty("--syntax-background", "rgb(221 231 241)");
  for (const id of ["read", "edit"]) expect(getComputedStyle(view.getByTestId(id).querySelector("pre")!).backgroundColor).toBe("rgb(221, 231, 241)");
});

test("domain roles can be overridden independently", () => {
  root.style.setProperty("--data-categorical-blue", "rgb(11 22 33)");
  root.style.setProperty("--syntax-keyword", "rgb(44 55 66)");
  root.style.setProperty("--syntax-added", "rgb(177 188 199)");
  const view = render(<DomainTokens />);
  expect(getComputedStyle(view.container.querySelector('[data-data-role="--data-categorical-blue"]')!).fill).toBe("rgb(11, 22, 33)");
  expect(getComputedStyle(view.container.querySelector('[data-syntax-role="--syntax-keyword"]')!).color).toBe("rgb(44, 55, 66)");
  expect(getComputedStyle(view.container.querySelector('[data-diff="added"]')!).backgroundColor).toBe("rgb(177, 188, 199)");
  expect(getComputedStyle(view.container.querySelector('[data-diff="removed"]')!).backgroundColor).not.toBe("rgb(177, 188, 199)");
  expect(getComputedStyle(view.container.querySelector('[data-data-role="--data-categorical-orange"]')!).fill).not.toBe("rgb(11, 22, 33)");
});
