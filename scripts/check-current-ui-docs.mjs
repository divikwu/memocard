import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Current maintenance contracts only. Dated migration reports retain their evidence.
export const CURRENT_UI_DOCS = [
  "README.md", "PROJECT_PLAN.md", "docs/CONTENT_STYLE.md",
  "design/README.md", "design/foundations.md", "design/token-system.md",
  "design/token-consumption.md", "design/component-docs.md", "design/component-inventory.md",
  "design/component-ownership.md", "design/typography.md", "design/native-typography.md",
  "design/ui-next-preview.md", "design/components/editor.md", "design/components/note-browser.md",
  "design/components/search-capture.md", "design/components/sidebar.md", "design/performance.md",
];
const root = fileURLToPath(new URL("..", import.meta.url));

export function validateCurrentDocument(markdown, filename, projectRoot = root, exists = existsSync) {
  const errors = [];
  const check = (target, base) => {
    const path = decodeURIComponent(target.replace(/^<|>$/g, "").split(/[?#]/)[0]);
    if (path && !exists(resolve(base, path))) errors.push(`${filename}: missing local reference ${target}`);
  };
  const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, "");
  const links = prose.replace(/`[^`\n]*`/g, "");
  for (const match of links.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    if (!/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(match[1].replace(/^</, ""))) check(match[1], dirname(resolve(projectRoot, filename)));
  }
  for (const [, path] of prose.matchAll(/`([^`\n]+)`/g)) {
    if (/[\s*{}]/.test(path)) continue;
    if (/^(?:apps|scripts|packages|design|docs)\//.test(path)) check(path, projectRoot);
    else if (/^(?:src|ui-next|test-support|\.storybook-next)\//.test(path)) check(path, resolve(projectRoot, "apps/ui"));
  }
  for (const [pattern, label] of [
    [/\bdefineTheme\b|\bThemeProvider\b/g, "retired theme API"],
    [/\bpnpm\s+(?:--filter\s+@memocard\/ui\s+)?theme:build\b/g, "retired theme command"],
    [/--project\s+(?:['"])?(?:docs-fonts|typography-[a-z*]+)/g, "retired browser test project"],
  ]) for (const match of markdown.matchAll(pattern)) errors.push(`${filename}: ${label}: ${match[0]}`);
  return errors;
}

export function checkCurrentUIDocs(projectRoot = root) {
  const errors = CURRENT_UI_DOCS.flatMap(filename => validateCurrentDocument(readFileSync(resolve(projectRoot, filename), "utf8"), filename, projectRoot));
  if (errors.length) throw new Error(errors.join("\n"));
  return CURRENT_UI_DOCS.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Current UI documentation passed: ${checkCurrentUIDocs()} scoped files.`);
