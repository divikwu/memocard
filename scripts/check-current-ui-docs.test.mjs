import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENT_UI_DOCS, validateCurrentDocument } from "./check-current-ui-docs.mjs";

test("current documentation resolves repository and relative source links", () => {
  const known = new Set(["/repo/apps/ui/src/App.tsx", "/repo/apps/ui/ui-next/theme.css"]);
  assert.deepEqual(validateCurrentDocument("[App](../apps/ui/src/App.tsx#L1) and `apps/ui/ui-next/theme.css` [upstream](https://example.com/docs)", "design/current.md", "/repo", path => known.has(path)), []);
});
test("missing local references fail even when the prose is otherwise valid", () => {
  const errors = validateCurrentDocument("[example](../apps/ui/missing.tsx)", "design/current.md", "/repo", () => false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /missing local reference/);
});
test("retired theme and browser commands cannot return to current contracts", () => {
  const errors = validateCurrentDocument("Use defineTheme with pnpm theme:build and --project docs-fonts", "design/current.md", "/repo", () => true);
  assert.equal(errors.length, 3);
});
test("the scope includes platform specs and excludes historical migration evidence", () => {
  assert.ok(CURRENT_UI_DOCS.includes("design/components/search-capture.md"));
  assert.ok(!CURRENT_UI_DOCS.includes("design/token-engineering.md"));
  assert.ok(!CURRENT_UI_DOCS.includes("design/ui-next.md"));
});

test("Markdown examples inside code are not treated as documentation links", () => {
  assert.deepEqual(validateCurrentDocument("`![image](../assets/example.jpg)`\n```markdown\n[example](missing.md)\n```", "PROJECT_PLAN.md", "/repo", () => false), []);
});

test("clean checkouts allow documented build destinations and still reject missing source and output assets", () => {
  const markdown = "`apps/ui/dist` `apps/ui/storybook-next-static` [states](../apps/ui/preview-next-static/) `apps/ui/dist-source` [missing asset](../apps/ui/dist/missing.js)";
  const errors = validateCurrentDocument(markdown, "design/current.md", "/repo", () => false);
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.includes("apps/ui/dist-source")));
  assert.ok(errors.some(error => error.includes("dist/missing.js")));
});

test("all current contracts pass without ignored Web, Storybook or preview output directories", () => {
  const projectRoot = fileURLToPath(new URL("..", import.meta.url));
  const missing = new Set(["apps/ui/dist", "apps/ui/storybook-next-static", "apps/ui/preview-next-static"].map(path => resolve(projectRoot, path)));
  const errors = CURRENT_UI_DOCS.flatMap(filename => validateCurrentDocument(readFileSync(resolve(projectRoot, filename), "utf8"), filename, projectRoot, path => !missing.has(path) && existsSync(path)));
  assert.deepEqual(errors, []);
});
