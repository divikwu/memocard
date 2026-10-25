import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { productionGraph } from './check-design-inventory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/ui/package.json', import.meta.url));
const ts = require('typescript'), { __unstable__loadDesignSystem } = require('tailwindcss');
const properties = ['font-family', 'font-size', 'font-weight', 'line-height'];
const inline = { fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', lineHeight: 'line-height' };

export function collectNativeTypography(documents) {
  const entries = new Map();
  for (const [source, original] of documents) {
    // Mask comments and string bodies while preserving offsets for source expressions.
    const code = original.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"/g, match => match.replace(/[^\n]/g, ' '));
    const lines = code.split('\n'), conditions = [], excluded = new Set();
    lines.forEach((line, index) => {
      if (/^\s*#if\b/.test(line)) conditions.push({ debug: /^\s*#if\s+DEBUG\s*$/.test(line), alternate: false });
      else if (/^\s*#else\b/.test(line) && conditions.length) conditions.at(-1).alternate = true;
      else if (/^\s*#endif\b/.test(line)) conditions.pop();
      if (conditions.some(condition => condition.debug && !condition.alternate)) excluded.add(index);
    });
    for (const match of code.matchAll(/\.(font|fontWeight|lineSpacing)\s*\(/g)) {
      const line = code.slice(0, match.index).split('\n').length - 1;
      if (excluded.has(line)) continue;
      let end = match.index + match[0].length, depth = 1;
      for (; end < code.length && depth; end++) { if (code[end] === '(') depth++; else if (code[end] === ')') depth--; }
      if (depth) throw new Error(`Unbalanced native typography expression: ${source}:${line + 1}`);
      const value = original.slice(match.index + match[0].length, end - 1).trim().replace(/\s+/g, ' '), property = match[1];
      const key = `${property}:${value}`, entry = entries.get(key) ?? { property, value, locations: [] };
      entry.locations.push({ source, line: line + 1 }); entries.set(key, entry);
    }
  }
  return [...entries.values()].sort((a, b) => a.property.localeCompare(b.property, 'en') || a.value.localeCompare(b.value, 'en', { numeric: true }));
}

function fontLonghands(value) {
  if (/^(inherit|initial|unset|revert|revert-layer)$/.test(value)) return properties.map(property => [property, value]);
  const variable = value.match(/^(?:(var\(--font-weight-[\w-]+\))\s+)?(var\(--font-size-[\w-]+\))(?:\s*\/\s*(var\(--[\w-]+\)|[\d.]+))?\s+(.+)$/);
  if (variable) return [['font-family', variable[4]], ['font-size', variable[2]], ['font-weight', variable[1] ?? 'normal'], ['line-height', variable[3] ?? 'normal']];
  const match = value.match(/^(.*?)\b(\d*\.?\d+(?:px|rem|em|%))(?:\s*\/\s*([^\s]+))?\s+(.+)$/);
  if (!match) throw new Error(`Unsupported font shorthand needs explicit catalog support: ${value}`);
  return [['font-family', match[4]], ['font-size', match[2]], ['font-weight', match[1].match(/\b(?:[1-9]00|bold|bolder|lighter|normal)\b/)?.[0] ?? 'normal'], ['line-height', match[3] ?? 'normal']];
}

export async function collectTypographyUsage(documents, theme) {
  const design = await __unstable__loadDesignSystem(theme), entries = new Map(), dynamic = [], bindings = new Map();
  const themeValues = {};
  postcss.parse(theme).walkDecls(decl => { themeValues[decl.prop] = decl.value; });
  function magnitude(entry) {
    const variable = entry.value.match(/^var\((--[\w-]+)\)$/)?.[1];
    const value = (variable ? themeValues[variable] : entry.value)?.match(/^(\d*\.?\d+)(px|em|rem|%)?$/);
    return value ? { value: Number(value[1]), unit: ['', 'em', 'rem', 'px', '%'].indexOf(value[2] ?? '') } : null;
  }
  const compiled = new Map();
  function add(property, value, source, scope, utility, variable) {
    if (!properties.includes(property)) return;
    const authored = value;
    value = value.replace(/^(-?)\.(\d)/, '$10.$2');
    const key = `${property}:${value}`, entry = entries.get(key) ?? { property, value, utilities: new Set(), locations: new Map() };
    if (utility) entry.utilities.add(utility);
    entry.locations.set(`${source}:${scope}:${variable ?? ''}`, { source, scope, value: authored, ...(variable ? { variable } : {}) }); entries.set(key, entry);
  }
  function bind(variable, value, source, scope) {
    const declarations = bindings.get(variable) ?? [];
    declarations.push({ variable, value, source, scope }); bindings.set(variable, declarations);
  }
  for (const [source, code] of documents) {
    const strings = [];
    if (source.endsWith('.css')) {
      const ast = postcss.parse(code);
      ast.walkAtRules('apply', rule => strings.push(rule.params));
      ast.walkDecls(decl => {
        const ancestors = [];
        for (let node = decl.parent; node.type !== 'root'; node = node.parent) ancestors.unshift(node.type === 'rule' ? node.selector : `@${node.name} ${node.params}`);
        if (ancestors.some(scope => scope.startsWith('@font-face'))) return;
        if (decl.prop.startsWith('--')) bind(decl.prop, decl.value, source, ancestors.join(' → '));
        for (const [property, value] of decl.prop === 'font' ? fontLonghands(decl.value) : [[decl.prop, decl.value]]) add(property, value, source, ancestors.join(' → '));
      });
    } else {
      const ast = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
        if (ts.isStringLiteralLike(node)) strings.push(node.text);
        if (ts.isTemplateExpression(node)) strings.push(node.head.text.replace(/\S+$/, ''), ...node.templateSpans.map((span, index) => {
          const text = span.literal.text.replace(/^\S+/, '');
          return index === node.templateSpans.length - 1 ? text : text.replace(/\S+$/, '');
        }));
        if (ts.isPropertyAssignment(node)) {
          if (node.name.text?.startsWith('--') && (ts.isStringLiteralLike(node.initializer) || ts.isNumericLiteral(node.initializer))) bind(node.name.text, node.initializer.text, source, `line ${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`);
          // beautiful-mermaid names its font-family option `font`, rather than a CSS longhand.
          const rendererFont = node.name.text === 'font' && ts.isCallExpression(node.parent.parent) && node.parent.parent.expression.getText(ast) === 'renderMermaidSVG';
          const property = inline[node.name.text] ?? (rendererFont ? 'font-family' : undefined);
          if (property) {
            const scope = `line ${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`, value = node.initializer;
            if (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value)) add(property, value.text + (ts.isNumericLiteral(value) && property === 'font-size' ? 'px' : ''), source, scope);
            else dynamic.push({ property, expression: value.getText(ast), source, scope });
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    for (const utility of new Set(strings.flatMap(string => string.split(/\s+/)))) {
      if (!compiled.has(utility)) compiled.set(utility, design.candidatesToCss([utility])[0]);
      const css = compiled.get(utility);
      if (css) postcss.parse(css).walkDecls(decl => add(decl.prop, decl.value, source, utility, utility));
    }
  }
  // Keep each binding's own selector/context; this is a dependency inventory, not a flattened cascade.
  const visited = new Set();
  for (const entry of entries.values()) for (const [, variable] of entry.value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const key = `${entry.property}:${variable}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const binding of bindings.get(variable) ?? []) add(entry.property, binding.value, binding.source, binding.scope, undefined, variable);
  }
  return {
    entries: [...entries.values()].map(entry => ({ ...entry, utilities: [...entry.utilities].sort((a, b) => Number(a.includes(':')) - Number(b.includes(':')) || a.length - b.length || a.localeCompare(b, 'en')), locations: [...entry.locations.values()].sort((a, b) => a.source.localeCompare(b.source, 'en') || a.scope.localeCompare(b.scope, 'en')) })).sort((a, b) => {
      const axis = properties.indexOf(a.property) - properties.indexOf(b.property);
      if (axis) return axis;
      const left = magnitude(a), right = magnitude(b);
      return (left && right ? left.unit - right.unit || left.value - right.value : Number(!left) - Number(!right)) || a.value.localeCompare(b.value, 'en', { numeric: true });
    }),
    dynamic: dynamic.sort((a, b) => a.source.localeCompare(b.source, 'en') || a.scope.localeCompare(b.scope, 'en')),
  };
}

export async function buildProjectTypographyCatalog({ check = false, outputPath = resolve(root, 'design/typography-usage.generated.json') } = {}) {
  const graph = await productionGraph(root);
  const documents = new Map(await Promise.all([...graph.keys()].map(async source => [source, await readFile(resolve(root, source), 'utf8')])));
  async function stylesheet(path) {
    const source = relative(root, path);
    if (documents.has(source)) return;
    const code = await readFile(path, 'utf8'), imports = [];
    documents.set(source, code);
    postcss.parse(code).walkAtRules('import', rule => {
      const target = rule.params.match(/^["']([^"']+)["']/)?.[1];
      if (target?.startsWith('.')) imports.push(resolve(dirname(path), target));
    });
    for (const target of imports) await stylesheet(target);
  }
  for (const [source, entry] of graph) for (const target of entry.imports) {
    if (target.endsWith('.css') && target.startsWith('.')) await stylesheet(resolve(root, dirname(source), target));
    else if (target.endsWith('.css') && target.startsWith('@/')) await stylesheet(resolve(root, 'apps/ui/src', target.slice(2)));
  }
  const upstream = await readFile(require.resolve('tailwindcss/theme.css'), 'utf8');
  const extensions = [...documents].filter(([source]) => source.endsWith('.css')).flatMap(([, code]) => postcss.parse(code).nodes.filter(node => node.type === 'atrule' && ['theme', 'custom-variant'].includes(node.name)).map(node => node.toString() + (node.nodes ? '' : ';'))).join('\n');
  const usage = await collectTypographyUsage(documents, `${upstream}\n${extensions}`), definitions = {};
  const references = new Set(usage.entries.flatMap(entry => [...entry.value.matchAll(/--[\w-]+/g)].map(match => match[0])));
  postcss.parse(upstream).walkDecls(decl => { if (references.has(decl.prop)) definitions[decl.prop] = decl.value; });
  const nativeSources = new Map(await Promise.all((await readdir(resolve(root, 'apps/apple/Sources'))).filter(name => name.endsWith('.swift') && !name.endsWith('.generated.swift')).sort().map(async name => {
    const source = `apps/apple/Sources/${name}`;
    return [source, await readFile(resolve(root, source), 'utf8')];
  })));
  const catalog = { version: 1, upstream: { source: 'tailwindcss/theme.css', version: require('tailwindcss/package.json').version, definitions }, ...usage, native: collectNativeTypography(nativeSources) };
  const content = JSON.stringify(catalog, null, 2) + '\n';
  const existing = await readFile(outputPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (existing !== content) {
    if (check) throw new Error('Project typography catalog is stale. Run pnpm typography:build.');
    await writeFile(outputPath, content);
  }
  return { ...Object.fromEntries(properties.map(property => [property, usage.entries.filter(entry => entry.property === property).length])), native: catalog.native.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-project-typography-catalog.mjs [--check]');
  console.log('Project typography catalog:', await buildProjectTypographyCatalog({ check: args.includes('--check') }));
}
