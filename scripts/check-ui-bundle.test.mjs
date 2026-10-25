import { test } from "node:test";
import assert from "node:assert/strict";
import { routeFiles, checkCurrentManifest } from "./check-ui-bundle.mjs";

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

test("production manifests reject retired UI and development stories while accepting shared cores", () => {
  for (const key of ["src/Editor.tsx", "src/components/quick-capture.tsx", "src/components/ui/button.tsx", "src/features/theme/ThemeProvider.tsx", "ui-next/stories/web.stories.tsx", "ui-next/preview/App.tsx", ".storybook-next/preview.tsx", "test-support/bridge.ts", "ui-state-fixtures/catalog.ts", "mascot-fixtures/catalog.ts"]) {
    assert.throws(() => checkCurrentManifest({ [key]: {} }), /Retired or development-only/);
  }
  assert.doesNotThrow(() => checkCurrentManifest({ "src/editor-core.tsx": {}, "ui-next/business/Editor.tsx": {}, "ui-next/preview-mode.tsx": {} }));
});
