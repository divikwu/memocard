import { test } from "node:test";
import assert from "node:assert/strict";
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
