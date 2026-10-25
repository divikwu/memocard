import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { productionGraph } from './check-design-inventory.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/ui/package.json', import.meta.url));
const ts = require('typescript'), { __unstable__loadDesignSystem } = require('tailwindcss');
const spacingRoot = /^-?(?:(?:p|m)(?:[xysetrbl]|bs|be)?|gap(?:-[xy])?|space-[xy]|scroll-[mp](?:[xysetrbl]|bs|be)?)$/;

export async function collectSpacingUsage(documents, theme) {
  const design = await __unstable__loadDesignSystem(theme), uses = new Map();
  for (const [source, code] of documents) {
    const strings = [];
    if (source.endsWith('.css')) postcss.parse(code).walkAtRules('apply', rule => strings.push(rule.params));
    else {
      const ast = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return;
        if (ts.isStringLiteralLike(node)) strings.push(node.text);
        if (ts.isTemplateExpression(node)) {
          // A utility touching interpolation is incomplete; do not infer its runtime suffix or prefix.
          strings.push(node.head.text.replace(/\S+$/, ''), ...node.templateSpans.map((span, index) => {
            const text = span.literal.text.replace(/^\S+/, '');
            return index === node.templateSpans.length - 1 ? text : text.replace(/\S+$/, '');
          }));
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    for (const utility of new Set(strings.flatMap(string => string.split(/\s+/)))) {
      const candidate = [...design.parseCandidate(utility)].find(item => item.kind === 'functional' && spacingRoot.test(item.root) && item.value);
      if (!candidate || !design.candidatesToCss([utility])[0]) continue;
      const value = candidate.value.value;
      const step = candidate.value.kind === 'named' && /^(?:\d+(?:\.\d+)?|px)$/.test(value) ? value : null;
      const entry = uses.get(utility) ?? { utility, step, value, consumers: new Set() };
      entry.consumers.add(source); uses.set(utility, entry);
    }
  }
  const usage = [...uses.values()].sort((a, b) => a.utility.localeCompare(b.utility, 'en')).map(entry => ({ ...entry, consumers: [...entry.consumers].sort() }));
  const steps = [...new Set(usage.map(entry => entry.step).filter(step => step !== null))].sort((a, b) => a === 'px' ? -1 : b === 'px' ? 1 : Number(a) - Number(b));
  const scale = steps.map(step => {
    let value;
    postcss.parse(design.candidatesToCss([`gap-${step}`])[0]).walkDecls('gap', declaration => { value = declaration.value; });
    if (!value) throw new Error(`Missing upstream spacing definition: ${step}`);
    return { step, value };
  });
  return { scale, usage };
}

export async function buildProjectSpacingCatalog({ check = false, outputPath = resolve(root, 'design/spacing-usage.generated.json') } = {}) {
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
  const theme = await readFile(require.resolve('tailwindcss/theme.css'), 'utf8');
  let base;
  postcss.parse(theme).walkDecls('--spacing', declaration => { base = declaration.value; });
  if (!base) throw new Error('Missing upstream --spacing definition');
  const custom = [...documents].filter(([source]) => source.endsWith('.css')).flatMap(([, code]) => postcss.parse(code).nodes.filter(node => node.type === 'atrule' && node.name === 'custom-variant').map(node => node.toString() + (node.nodes ? '' : ';'))).join('\n');
  const catalog = { version: 1, upstream: { source: 'tailwindcss/theme.css', version: require('tailwindcss/package.json').version, name: '--spacing', value: base }, ...await collectSpacingUsage(documents, `${theme}\n${custom}`) };
  const content = JSON.stringify(catalog, null, 2) + '\n';
  const existing = await readFile(outputPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (existing !== content) {
    if (check) throw new Error('Project spacing catalog is stale. Run pnpm spacing:build.');
    await writeFile(outputPath, content);
  }
  return { steps: catalog.scale.length, utilities: catalog.usage.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/build-project-spacing-catalog.mjs [--check]');
  console.log('Project spacing catalog:', await buildProjectSpacingCatalog({ check: args.includes('--check') }));
}
