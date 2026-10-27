// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import ts from "typescript";

// A visible Canvas may assert its initial state, but scripted user actions and
// DOM probes belong to hidden, test-enabled regression stories.
function previewViolations(text: string, filename = "example.stories.tsx") {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map<string, ts.Expression>();
  const exports: ts.VariableDeclaration[] = [];
  let meta: ts.Expression | undefined;
  const userEvents = new Set(["userEvent"]);
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        if ((binding.propertyName ?? binding.name).text === "userEvent") userEvents.add(binding.name.text);
      }
    }
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) declarations.set(declaration.name.text, declaration.initializer);
      if (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) exports.push(declaration);
    }
    if (ts.isExportAssignment(statement)) meta = statement.expression;
  }
  function property(node: ts.Expression | undefined, name: string, seen = new Set<ts.Node>()): ts.Node | undefined {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (ts.isIdentifier(node)) return property(declarations.get(node.text), name, seen);
    if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return property(node.expression, name, seen);
    if (!ts.isObjectLiteralExpression(node)) return;
    for (const entry of [...node.properties].reverse()) {
      if (ts.isSpreadAssignment(entry)) {
        const inherited = property(entry.expression, name, seen);
        if (inherited) return inherited;
      } else if (entry.name?.getText(source) === name) {
        return ts.isPropertyAssignment(entry) ? entry.initializer : entry;
      }
    }
  }
  const mutations = new Set(["click", "focus", "blur", "scrollIntoView", "scrollTo", "scrollBy", "append", "appendChild", "remove", "removeChild", "replaceChildren", "dispatchEvent", "setProperty"]);
  const violations: string[] = [];
  for (const story of exports) {
    const play = property(story.initializer, "play") ?? property(meta, "play");
    if (!play) continue;
    const tags = new Set(["dev", "test"]);
    for (const node of [property(meta, "tags"), property(story.initializer, "tags")]) {
      if (node && ts.isArrayLiteralExpression(node)) for (const tag of node.elements.filter(ts.isStringLiteral)) {
        if (tag.text.startsWith("!")) tags.delete(tag.text.slice(1));
        else tags.add(tag.text);
      }
    }
    let interactive = false;
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const call = node.expression;
        if (userEvents.has(call.expression.getText(source)) || mutations.has(call.name.text)) interactive = true;
      }
      ts.forEachChild(node, visit);
    }
    visit(play);
    if (interactive && (tags.has("dev") || tags.has("autodocs") || !tags.has("test"))) violations.push(story.name.getText(source));
  }
  return violations;
}

it("rejects automatic input, focus, scrolling and DOM mutations in visible previews", () => {
  for (const action of ["user.click(button)", "input.focus()", "card.scrollIntoView()", "canvas.append(probe)"]) {
    expect(previewViolations(`import { userEvent as user } from 'storybook/test'; export const Example = { play: async () => { ${action}; } };`)).toEqual(["Example"]);
  }
});

it("follows inherited play functions and keeps hidden regressions enabled for tests", () => {
  const base = "const shared = { play: async () => { userEvent.click(button); } };";
  expect(previewViolations(`${base} export const Example = { ...shared };`)).toEqual(["Example"]);
  expect(previewViolations(`${base} export const Regression = { ...shared, tags: ['!dev', '!autodocs'] };`)).toEqual([]);
  expect(previewViolations(`${base} export const Regression = { ...shared, tags: ['!dev', '!autodocs', '!test'] };`)).toEqual(["Regression"]);
  expect(previewViolations(`${base} const meta = { tags: ['!dev'] }; export default meta; export const Example = { ...shared, tags: ['dev'] };`)).toEqual(["Example"]);
  expect(previewViolations("export const Example = { play: async () => { await expect(button).toBeVisible(); } }; ")).toEqual([]);
});

it("keeps every Storybook preview free of scripted interactions", () => {
  const directory = new URL("../ui/stories/", import.meta.url);
  const failures = readdirSync(directory).filter(file => file.endsWith(".stories.tsx"))
    .flatMap(file => previewViolations(readFileSync(new URL(file, directory), "utf8"), file).map(story => `${file}: ${story}`));
  expect(failures).toEqual([]);
});
