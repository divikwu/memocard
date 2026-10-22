import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionGraph } from './check-design-inventory.mjs';
import { sidebarIconComponents } from './generate-sidebar-icons.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/ui/package.json', import.meta.url));
const ts = require('typescript'), lucide = require('lucide-react');
const { createElement } = require('react'), { renderToStaticMarkup } = require('react-dom/server');

// Bind local symbols without loading dependencies: aliases, shadowing and type-only
// references must not turn unused imports into displayed icons.
export function collectIconReferences(documents) {
  const options = { noResolve: true, noLib: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest };
  const host = ts.createCompilerHost(options);
  const files = new Map([...documents].map(([path, code]) => [resolve(path), ts.createSourceFile(resolve(path), code, options.target, true)]));
  host.getSourceFile = path => files.get(resolve(path));
  const checker = ts.createProgram([...files.keys()], options, host).getTypeChecker();
  const references = new Map();
  for (const [path] of documents) {
    const source = files.get(resolve(path)), imports = new Map();
    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement) && statement.moduleSpecifier?.text === 'lucide-react' && !statement.isTypeOnly) throw new Error(`Register Lucide re-export usage before cataloguing: ${path}`);
      if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'lucide-react' || statement.importClause?.isTypeOnly) continue;
      const clause = statement.importClause;
      if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings) || clause.name) throw new Error(`Use named Lucide imports for the icon catalog: ${path}`);
      for (const specifier of clause.namedBindings.elements) if (!specifier.isTypeOnly) imports.set(checker.getSymbolAtLocation(specifier.name), specifier.propertyName?.text ?? specifier.name.text);
    }
    function visit(node) {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0]?.text === 'lucide-react') throw new Error(`Use named Lucide imports for the icon catalog: ${path}`);
      if (ts.isIdentifier(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent) ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
        const imported = imports.get(symbol);
        if (imported) {
          const component = lucide[imported], name = component?.displayName;
          if (!name || lucide[name] !== component) throw new Error(`Unsupported Lucide value: ${path} ${imported}`);
          const consumers = references.get(name) ?? new Set();
          consumers.add(path); references.set(name, consumers);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return references;
}

export async function buildProjectIconCatalog({ check = false, outputPath = resolve(root, 'design/icon-usage.generated.json') } = {}) {
  const graph = await productionGraph(root);
  const documents = new Map(await Promise.all([...graph.keys()].map(async path => [path, await readFile(resolve(root, path), 'utf8')])));
  const references = collectIconReferences(documents);
  // The native sidebar consumes this explicit bridge-to-Lucide mapping, rather
  // than importing React components. System SF Symbols are outside this catalog.
  for (const imported of Object.values(sidebarIconComponents)) {
    const name = lucide[imported].displayName, consumers = references.get(name) ?? new Set();
    consumers.add('apps/apple/Sources/NativeSidebar.swift'); references.set(name, consumers);
  }
  const icons = [...references].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, consumers]) => ({
    name, svg: renderToStaticMarkup(createElement(lucide[name], { size: 24, color: '#000000', strokeWidth: 2 })), consumers: [...consumers].sort(),
  }));
  const content = JSON.stringify({ version: 1, icons }, null, 2) + '\n';
  const existing = await readFile(outputPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (existing !== content) {
    if (check) throw new Error('Project icon catalog is stale. Run pnpm icons:build.');
    await writeFile(outputPath, content);
  }
  return { icons: icons.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-project-icon-catalog.mjs [--check]');
  console.log('Project icon catalog:', await buildProjectIconCatalog({ check: args.includes('--check') }));
}
