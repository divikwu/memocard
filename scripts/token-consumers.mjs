import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, relative, extname } from 'node:path';
import postcss from 'postcss';

const customNames = text => [...text.matchAll(/(?<![\w-])--[a-zA-Z_][\w-]*/g)].map(match => match[0]);
const sorted = values => [...new Set(values)].sort();
const templatePattern = value => new RegExp(`^${value.split(/\$\{[^}]+\}/).map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\w-]+')}$`);

export function inspectConsumerText(text, names, dynamic = []) {
  const found = new Set(customNames(text).filter(name => names.has(name)));
  // Bounded templates preserve both the prefix and suffix. Unbounded palette reads need an explicit contract.
  for (const [template] of text.matchAll(/(?<![\w-])--(?:[a-zA-Z_]|\$\{[^}]+\})(?:[\w-]|\$\{[^}]+\})*/g)) {
    if (!template.includes('${')) continue;
    if (/^--\$\{[^}]+\}$/.test(template)) {
      if (!dynamic.length) throw new Error(`Unbounded dynamic token read: ${template}`);
      for (const name of dynamic) found.add(name);
    } else {
      const pattern = templatePattern(template);
      const matches = [...names].filter(name => pattern.test(name));
      if (!matches.length) throw new Error(`Unknown dynamic token reference: ${template}`);
      for (const name of matches) found.add(name);
    }
  }
  return sorted(found);
}

export function checkConsumerReferences(text, known, source) {
  for (const [, name] of text.matchAll(/(?:var\(|\()\s*(--[\w-]+)\s*(?=[,)])/g)) {
    if (!known.has(name)) throw new Error(`Unknown consumer reference: ${source} ${name}`);
  }
}

async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory()
    ? files(resolve(directory, entry.name)) : [resolve(directory, entry.name)]))).flat();
}

export async function collectTokenConsumers({ root, registry, graph, reached, records, runtime, portable }) {
  const require = createRequire(resolve(root, 'apps/ui/package.json'));
  const ts = require('typescript'), { __unstable__loadDesignSystem } = require('tailwindcss');
  const names = new Set([...records.map(record => record.name), ...runtime.map(token => token.name)]);
  for (const entry of registry.externalSources ?? []) for (const name of Object.keys(entry.tokens)) names.add(name);
  for (const path of registry.generatedSources) postcss.parse(await readFile(resolve(root, path), 'utf8')).walkDecls(decl => names.add(decl.prop));
  const known = new Set(names), sourcePaths = [...graph.keys(), ...[...reached].map(path => relative(root, path))].sort();
  for (const path of registry.upstreamSources) postcss.parse(await readFile(resolve(root, path), 'utf8')).walkDecls(decl => { known.add(decl.prop); names.add(decl.prop); });
  // Local CSS variables may cross selectors, and inline styles may feed a component stylesheet.
  for (const source of sourcePaths) {
    const code = await readFile(resolve(root, source), 'utf8');
    if (source.endsWith('.css')) postcss.parse(code).walkDecls(decl => known.add(decl.prop));
    else {
      const ast = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true);
      function visit(node) {
        if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name)) known.add(node.name.text);
        if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
          for (const [, name] of node.getText(ast).matchAll(/(--[\w-]+)\s*:/g)) known.add(name);
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'setProperty' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) known.add(node.arguments[0].text);
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
  const styles = postcss.parse(await readFile(resolve(root, 'apps/ui/src/styles.css'), 'utf8'));
  const utilities = styles.nodes.filter(node => node.type === 'atrule' && ['utility', 'custom-variant'].includes(node.name)).map(node => node.toString() + (node.nodes ? '' : ';')).join('\n');
  // Every owning source is included once; imports between those sources would
  // duplicate declarations and have no relative base in this combined input.
  const theme = (await Promise.all([...registry.upstreamSources, ...new Set(registry.families.map(family => family.source))].map(path => readFile(resolve(root, path), 'utf8')))).map(css => {
    const ast = postcss.parse(css);
    ast.walkAtRules('import', rule => rule.remove());
    return ast.toString();
  }).join('\n');
  // Use the locked Tailwind compiler for variants, opacity, arbitrary values and @theme inline substitution.
  const design = await __unstable__loadDesignSystem(`${theme}\n${utilities}`);
  const rows = [], dynamicSources = new Map((registry.dynamicConsumers ?? []).map(entry => [entry.source, entry]));
  const styleClasses = new Map();
  for (const path of reached) {
    postcss.parse(await readFile(path, 'utf8')).walkRules(rule => {
      const values = [];
      rule.walkDecls(decl => values.push(decl.value));
      const tokens = inspectConsumerText(values.join('\n'), names);
      for (const [, name] of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
        if (['dark', 'light'].includes(name)) continue;
        styleClasses.set(name, sorted([...(styleClasses.get(name) ?? []), ...tokens]));
      }
    });
  }
  const cache = new Map();
  function utilityTokens(candidates) {
    const missing = candidates.filter(candidate => !cache.has(candidate));
    design.candidatesToCss(missing).forEach((css, index) => cache.set(missing[index], customNames(css ?? '').filter(name => names.has(name))));
    return sorted(candidates.flatMap(candidate => cache.get(candidate)));
  }
  for (const source of sourcePaths) {
    if (source.includes('/generated/')) continue;
    const code = await readFile(resolve(root, source), 'utf8'), strings = [], overrides = new Set(), portableUses = new Set();
    const producers = (registry.dynamicProducers ?? []).filter(entry => entry.source === source);
    if (source.endsWith('.css')) {
      postcss.parse(code).walkDecls(decl => {
        strings.push(decl.value);
        if (names.has(decl.prop)) overrides.add(decl.prop);
      });
      postcss.parse(code).walkAtRules('apply', rule => strings.push(rule.params));
    } else {
      const ast = ts.createSourceFile(source, code, ts.ScriptTarget.Latest, true);
      function visit(node) {
        const producer = (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) && producers.find(entry => entry.expression === node.getText(ast));
        if (producer) {
          for (const name of names) if (new RegExp(producer.pattern).test(name)) overrides.add(name);
          return;
        }
        if (ts.isStringLiteralLike(node)) strings.push(node.text);
        if (ts.isTemplateExpression(node)) strings.push(node.getText(ast).slice(1, -1));
        if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && names.has(node.name.text)) overrides.add(node.name.text);
        if ((ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) && ts.isIdentifier(node.expression)) {
          const group = { radiusValues: 'radius', spacingValues: 'spacing', sidebarTokens: 'sidebar' }[node.expression.text];
          if (group) {
            const key = ts.isPropertyAccessExpression(node) ? node.name.text : node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null;
            const matches = portable.filter(token => token.name.startsWith(`${group}.`) && (!key || token.name === `${group}.${key}`));
            if (!matches.length) throw new Error(`Unknown portable token reference: ${source} ${group}.${key}`);
            for (const token of matches) portableUses.add(token.name);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    const dynamic = dynamicSources.get(source);
    if (dynamic && !code.includes(dynamic.expression)) throw new Error(`Stale dynamic consumer contract: ${source}`);
    for (const name of dynamic?.tokens ?? []) if (!names.has(name)) throw new Error(`Unknown dynamic consumer token: ${source} ${name}`);
    const text = strings.join('\n'), direct = inspectConsumerText(text, names, dynamic?.tokens);
    checkConsumerReferences(text, known, source);
    const candidates = sorted(strings.flatMap(string => string.split(/\s+/)));
    const utilities = utilityTokens(candidates);
    const styles = new Set();
    for (const candidate of candidates) {
      const matches = candidate.includes('${') ? [...styleClasses.keys()].filter(name => templatePattern(candidate).test(name)) : [candidate];
      for (const name of matches) for (const token of styleClasses.get(name) ?? []) styles.add(token);
    }
    const tokens = sorted([...direct, ...utilities, ...styles]);
    if (tokens.length || overrides.size || portableUses.size) rows.push({ source, direct, utilities, styles: sorted(styles), overrides: sorted(overrides), portable: sorted(portableUses) });
    dynamicSources.delete(source);
  }
  if (dynamicSources.size) throw new Error(`Unreachable dynamic consumer: ${[...dynamicSources.keys()].join(', ')}`);
  // Native references include authored DEBUG previews; they are not all release paths.
  const native = [];
  for (const path of await files(resolve(root, 'apps/apple/Sources'))) {
    if (extname(path) !== '.swift' || path.endsWith('.generated.swift')) continue;
    const code = (await readFile(path, 'utf8')).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    const tokens = sorted([...code.matchAll(/\b(DesignRadius|SidebarTokens)\s*\.\s*(\w+)/g)].map(([, group, name]) => `${group === 'DesignRadius' ? 'radius' : 'sidebar'}.${name === 'radius2xl' ? '2xl' : name}`));
    for (const name of tokens) if (!portable.some(token => token.name === name)) throw new Error(`Unknown native token: ${path} ${name}`);
    const outputs = runtime.filter(token => token.source === relative(root, path)).map(token => token.name);
    if (tokens.length || outputs.length) native.push({ source: relative(root, path), tokens, outputs });
  }
  return { rows, native, modules: graph.size, stylesheets: reached.size };
}
