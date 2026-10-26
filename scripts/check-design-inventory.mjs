import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const normalize = path => path.split(sep).join('/');
const excluded = path => /(?:^|\/)(?:__tests__|stories)(?:\/|$)|\.(?:test|spec|stories)\.[cm]?[jt]sx?$/.test(path);

export async function productionGraph(root = repository) {
  const ts = createRequire(resolve(root, 'apps/ui/package.json'))('typescript');
  const config = ts.readConfigFile(resolve(root, 'apps/ui/tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const options = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(root, 'apps/ui')).options;
  const sourceRoots = ['apps/ui/src', 'apps/ui/ui-next'].map(path => resolve(root, path) + sep);
  const visited = new Set();
  const graph = new Map();
  async function visit(file) {
    if (visited.has(file) || excluded(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const imports = new Set();
    function inspect(node) {
      if (ts.isImportDeclaration(node)) {
        // Inline type specifiers can preserve module side effects under verbatimModuleSyntax.
        if (!node.importClause?.isTypeOnly) imports.add(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        // Keep inline re-export edges conservatively; emitter elision differs from source reachability.
        if (!node.isTypeOnly) imports.add(node.moduleSpecifier.text);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (!node.arguments.length || !ts.isStringLiteralLike(node.arguments[0])) {
          throw new Error(`Nonliteral runtime import needs explicit inventory support: ${normalize(relative(root, file))}`);
        }
        imports.add(node.arguments[0].text);
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
    const local = [];
    for (const specifier of imports) {
      const target = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (target && sourceRoots.some(sourceRoot => target.startsWith(sourceRoot)) && /\.tsx?$/.test(target) && !target.endsWith('.d.ts') && !excluded(target)) {
        local.push(target);
      }
    }
    graph.set(normalize(relative(root, file)), { imports: [...imports], local: local.map(path => normalize(relative(root, path))) });
    for (const target of local) await visit(target);
  }
  await visit(resolve(root, 'apps/ui/src/main.tsx'));
  return graph;
}

export async function checkInventory({ root = repository, inventory = 'design/component-inventory.md' } = {}) {
  const markdown = await readFile(resolve(root, inventory), 'utf8');
  const entries = new Set();
  const errors = [];
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const path = line.match(/^\| `([^`]+)`/)?.[1];
    if (!path) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length !== 6 || cells.some(cell => !cell)) errors.push(`Incomplete inventory row: ${path}`);
    if (entries.has(path)) errors.push(`Duplicate implementation: ${path}`);
    entries.add(path);
    for (const [, reference] of line.matchAll(/`((?:apps|design|scripts|packages)\/[^`]+)`/g)) {
      if (!existsSync(resolve(root, reference))) errors.push(`Missing inventory path: ${reference}`);
    }
  }
  const graph = await productionGraph(root);
  const production = [...graph.keys()].filter(path => path.endsWith('.tsx')).sort();
  for (const path of production) if (!entries.has(path)) errors.push(`Unlisted production TSX: ${path}`);
  for (const path of entries) {
    if (/^apps\/ui\/(?:src|ui-next)\//.test(path) && path.endsWith('.tsx') && !graph.has(path)) {
      errors.push(`Inventory TSX is not production-reachable: ${path}`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { productionModules: production.length, entries: entries.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await checkInventory();
  console.log(`Design inventory passed: ${result.productionModules} reachable production TSX modules; ${result.entries} maintained entries. Story/state coverage is documented separately.`);
}
