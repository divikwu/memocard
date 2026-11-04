import { test } from "node:test";
import assert from "node:assert/strict";
import { routeFiles, startupFiles, firstListFiles, checkCurrentManifest, checkCurrentStylesheet } from "./check-ui-bundle.mjs";

test("route costs include transitive shared JS/CSS once and keep optional dynamic routes separate", () => {
  const manifest = {
    "index.html": { file: "entry.js", css: ["entry.css"], imports: ["shared"], dynamicImports: ["editor"] },
    shared: { file: "shared.js", css: ["shared.css"], imports: ["index.html"] },
    editor: { file: "editor.js", css: ["editor.css", "shared.css"], imports: ["shared"] },
  };
  assert.deepEqual([...routeFiles(manifest)].sort(), ["entry.css", "entry.js", "shared.css", "shared.js"]);
  assert.deepEqual([...routeFiles(manifest, ["editor", "editor"])].sort(), ["editor.css", "editor.js", "entry.css", "entry.js", "shared.css", "shared.js"]);
  assert.throws(() => routeFiles(manifest, ["removed"]), /Missing route asset/);
});

test("browser startup includes its awaited storage runtime while native and local Web exclude it", () => {
  const manifest = {
    "index.html": { file: "entry.js", imports: ["shared"], dynamicImports: ["src/browser-vault.ts"] },
    shared: { file: "shared.js" },
    "src/browser-vault.ts": { file: "storage.js", imports: ["shared", "file-io"], dynamicImports: ["formats"] },
    "file-io": { file: "file-io.js" },
    formats: { file: "formats.js" },
  };
  assert.deepEqual([...startupFiles(manifest, "browser")].sort(), ["entry.js", "file-io.js", "shared.js", "storage.js"]);
  for (const mode of ["native", "local-web"]) assert.deepEqual([...startupFiles(manifest, mode)].sort(), ["entry.js", "shared.js"]);
  assert.throws(() => startupFiles({ "index.html": { file: "entry.js" } }, "browser"), /Missing route asset/);
});

test("a bound browser first list includes format parsing and filters even when loaded after mount", () => {
  const fonts = {
    "node_modules/@fontsource-variable/noto-sans/wght-italic.css": { file: "sans-italic.css" },
    "node_modules/@fontsource-variable/geist-mono/wght.css": { file: "mono.css" },
    "node_modules/@fontsource-variable/geist-mono/wght-italic.css": { file: "mono-italic.css" },
  };
  const manifest = {
    ...fonts,
    "index.html": { file: "entry.js", imports: ["shared"] },
    shared: { file: "shared.js" },
    "src/browser-vault.ts": { file: "storage.js", imports: ["shared"] },
    "src/browser-files.ts": { file: "formats.js", imports: ["yaml"] },
    yaml: { file: "yaml.js" },
    "src/note-filters.ts": { file: "filters.js", imports: ["shared"] },
    cards: { file: "cards.js", imports: ["yaml"] },
  };
  assert.deepEqual([...firstListFiles(manifest, "browser")].sort(), ["entry.js", "filters.js", "formats.js", "shared.js", "storage.js", "yaml.js"].sort());
  assert.deepEqual([...firstListFiles(manifest, "browser", ["cards"])].sort(), ["cards.js", "entry.js", "filters.js", "formats.js", "shared.js", "storage.js", "yaml.js"].sort());
  for (const mode of ["native", "local-web"]) assert.deepEqual([...firstListFiles(manifest, mode)].sort(), ["entry.js", "shared.js"].sort());
  delete manifest["node_modules/@fontsource-variable/geist-mono/wght.css"];
  assert.doesNotThrow(() => firstListFiles(manifest, "browser"));
  Object.assign(manifest, fonts);
  delete manifest["src/browser-files.ts"];
  assert.throws(() => firstListFiles(manifest, "browser"), /Missing route asset/);
});

test("production manifests reject retired UI and development stories while accepting shared cores", () => {
  for (const key of ["src/Editor.tsx", "src/components/quick-capture.tsx", "src/components/ui/button.tsx", "src/features/theme/ThemeProvider.tsx", "src/generated/design-tokens.ts", "src/generated/design-tokens.css", "ui/stories/web.stories.tsx", "ui/preview/App.tsx", ".storybook/preview.tsx", "test-support/bridge.ts", "ui-state-fixtures/catalog.ts", "mascot-fixtures/catalog.ts"]) {
    assert.throws(() => checkCurrentManifest({ [key]: {} }), /Retired or development-only/);
  }
  assert.doesNotThrow(() => checkCurrentManifest({ "src/editor-core.tsx": {}, "ui/business/Editor.tsx": {}, "ui/preview-mode.tsx": {} }));
});

test("bundled CSS rejects inlined retired tokens and layout utilities without banning the current card layout", () => {
  assert.throws(() => checkCurrentStylesheet('@layer base{:root{--radius:.625rem;--sidebar-icon-size:16px}}', "entry.css"), /Retired Web token/);
  assert.throws(() => checkCurrentStylesheet(':root[data-radius=lg]{--radius:1rem}', "entry.css"), /Retired Web token/);
  assert.throws(() => checkCurrentStylesheet(String.raw`.grid-cols-\[repeat\(auto-fill\,minmax\(min\(100\%\,320px\)\,1fr\)\)\]{grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))}`, "entry.css"), /Retired collection layout utility/);
  assert.doesNotThrow(() => checkCurrentStylesheet('/* --radius:10px */ :root{--radius-element:.5rem;--sidebar-width:16rem}.widget{--radius:1rem}.ui-note-cards{grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))}', "entry.css"));
});


test("theme CSS and its shared layout add their resource closures once", () => {
  const manifest = {
    "index.html": { file: "entry.js", imports: ["shared"] },
    shared: { file: "shared.js" },
    skin: { file: "skin.css" },
    layout: { file: "layout.js", css: ["layout.css"], imports: ["shared"] },
  };
  assert.deepEqual([...routeFiles(manifest, ["skin", "layout", "layout"])].sort(), ["entry.js", "layout.css", "layout.js", "shared.js", "skin.css"]);
  assert.deepEqual([...routeFiles(manifest)].sort(), ["entry.js", "shared.js"]);
});

test("optional Markdown and property editors retain their full transitive cost when opened", () => {
  const manifest = {
    "index.html": { file: "entry.js", dynamicImports: ["editor"] },
    editor: { file: "editor.js", imports: ["media"], dynamicImports: ["markdown", "properties"] },
    media: { file: "media.js", css: ["content.css"] },
    markdown: { file: "markdown.js", imports: ["media", "parser"] },
    parser: { file: "parser.js" },
    properties: { file: "properties.js", imports: ["calendar"] },
    calendar: { file: "calendar.js", css: ["calendar.css"] },
  };
  assert.deepEqual([...routeFiles(manifest, ["editor"])].sort(), ["content.css", "editor.js", "entry.js", "media.js"]);
  assert.deepEqual([...routeFiles(manifest, ["editor", "markdown", "properties"])].sort(), ["calendar.css", "calendar.js", "content.css", "editor.js", "entry.js", "markdown.js", "media.js", "parser.js", "properties.js"]);
});
