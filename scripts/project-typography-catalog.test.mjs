import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectNativeTypography, collectTypographyUsage, buildProjectTypographyCatalog } from './build-project-typography-catalog.mjs';
import { productionGraph } from './check-design-inventory.mjs';

const require = createRequire(new URL('../apps/ui/package.json', import.meta.url));
const theme = await readFile(require.resolve('tailwindcss/theme.css'), 'utf8');

test('follows local typography variable bindings across selectors, aliases and cycles', async () => {
  const result = await collectTypographyUsage(new Map([['fixture.css', `
    .typeset { --typeset-size: var(--note-size, 16px); font-size: var(--typeset-size); line-height: var(--note-leading); }
    .card { --note-size: 13px; --note-leading: 1.55; --unrelated: 99px; }
    .summary { --note-size: var(--summary-size, 15px); }
    .cycle { --summary-size: var(--note-size); }
  `]]), theme);
  assert.ok(result.entries.find(row => row.property === 'line-height' && row.value === '1.55').locations.some(location => location.scope === '.card' && location.variable === '--note-leading'));
  assert.ok(result.entries.find(row => row.property === 'font-size' && row.value === '13px').locations.some(location => location.variable === '--note-size'));
  assert.ok(result.entries.some(row => row.value === 'var(--summary-size, 15px)'));
  assert.ok(!result.entries.some(row => row.value === '99px'));
  const inline = await collectTypographyUsage(new Map([['fixture.tsx', `const style = { '--local-leading': '1.55', lineHeight: 'var(--local-leading)' };`]]), theme);
  assert.ok(inline.entries.some(row => row.property === 'line-height' && row.value === '1.55'));
});

test('collects compiled utility typography, modifiers and CSS shorthand while retaining context', async () => {
  const result = await collectTypographyUsage(new Map([
    ['fixture.tsx', `const view = <div className="md:text-sm text-base/7 font-semibold leading-6 text-red-500 p-12"/>;`],
    ['fixture.css', '@font-face {font-family: Asset; font-weight: 100 900;} .hint {font: 13px/1.5 var(--font-sans);} @media (min-width:48rem) {.note {font-size: 1.75em;}}'],
  ]), theme);
  assert.ok(result.entries.find(row => row.property === 'font-size' && row.value === 'var(--text-sm)').utilities.includes('md:text-sm'));
  assert.ok(result.entries.find(row => row.property === 'line-height' && row.value === 'calc(var(--spacing) * 7)').utilities.includes('text-base/7'));
  for (const [property, value] of [['font-family', 'var(--font-sans)'], ['font-size', '13px'], ['font-weight', 'normal'], ['line-height', '1.5']]) assert.ok(result.entries.find(row => row.property === property && row.value === value));
  assert.ok(result.entries.find(row => row.value === '1.75em').locations[0].scope.includes('@media (min-width:48rem)'));
  assert.ok(!result.entries.some(row => /Asset|100 900/.test(row.value)));
  assert.ok(result.entries.every(row => !row.utilities.includes('text-red-500') && !row.utilities.includes('p-12')));
});

test('collects literal inline/CSS-in-JS styles, retains dynamic references and excludes incomplete or non-runtime candidates', async () => {
  const result = await collectTypographyUsage(new Map([['fixture.tsx', `
    import 'text-9xl'; type T = 'font-black'; // leading-96
    const style = {fontSize: 15, fontWeight: 500, lineHeight: 1.6, fontFamily: FONT_FAMILIES[value]};
    renderMermaidSVG(source, {font: 'system-ui'});
    const classes = \`text-xs \${selected ? 'font-medium' : 'font-normal'} leading-\${size} \${prefix}text-8xl\`;
  `]]), theme);
  assert.ok(result.entries.find(row => row.property === 'font-size' && row.value === '15px'));
  assert.ok(result.entries.find(row => row.property === 'font-weight' && row.value === '500'));
  assert.ok(result.entries.find(row => row.property === 'line-height' && row.value === '1.6'));
  assert.ok(result.entries.find(row => row.property === 'font-family' && row.value === 'system-ui'));
  assert.deepEqual(result.dynamic.map(row => row.expression), ['FONT_FAMILIES[value]']);
  assert.ok(!result.entries.some(row => row.utilities.some(utility => /9xl|8xl|black|96/.test(utility))));
});

test('deduplicates equivalent decimal notation, preserves original declarations, and rejects unsupported shorthand', async () => {
  const result = await collectTypographyUsage(new Map([['fixture.css', '.a {font-size:.875em;} .b {font-size:0.875em; font:inherit;}']]), theme);
  const row = result.entries.find(row => row.value === '0.875em');
  assert.deepEqual(row.locations.map(location => location.value), ['.875em', '0.875em']);
  assert.equal(result.entries.filter(row => row.value === 'inherit').length, 4);
  await assert.rejects(collectTypographyUsage(new Map([['fixture.css', '.a {font:var(--unknown-shorthand);}']]), theme), /explicit catalog support/);
  const sorted = await collectTypographyUsage(new Map([['fixture.css', '.a {font-size:0.9em; font-size:0.8125em; font-size:0.75em; font-size:1.25em;}']]), theme);
  assert.deepEqual(sorted.entries.map(entry => entry.value), ['0.75em', '0.8125em', '0.9em', '1.25em']);
});

test('production catalog is reachable and stable; drift checks preserve the file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-typography-catalog-'));
  try {
    const outputPath = join(directory, 'typography.json');
    await buildProjectTypographyCatalog({ outputPath });
    const catalog = JSON.parse(await readFile(outputPath, 'utf8')), graph = await productionGraph();
    assert.equal(catalog.upstream.version, require('tailwindcss/package.json').version);
    assert.ok(catalog.entries.find(row => row.value === '0.875rem').locations.some(location => location.variable === '--font-size-sm'));
    assert.ok(catalog.entries.some(row => row.property === 'font-size' && row.value === 'var(--font-size-sm)'));
    assert.ok(catalog.entries.length > 40);
    assert.equal(new Set(catalog.entries.map(row => `${row.property}:${row.value}`)).size, catalog.entries.length);
    assert.ok(catalog.entries.every(row => row.locations.length && row.locations.every(location => location.source.endsWith('.css') || graph.has(location.source))));
    assert.ok(catalog.entries.every(row => row.locations.every(location => !/stories|\.(?:test|spec)\./.test(location.source))));
    assert.ok(catalog.entries.find(row => row.property === 'font-size' && row.value === 'var(--font-size-note-title)').locations.some(location => location.scope === '.ui-note-editor .note-page-title'));
    assert.ok(catalog.entries.find(row => row.property === 'font-size' && row.value === '2rem').locations.some(location => location.variable === '--font-size-note-title' && location.source === 'apps/ui/ui/theme.css'));
    assert.ok(catalog.entries.find(row => row.property === 'font-family' && row.value === 'var(--font-family-body)').locations.some(location => location.source.endsWith('/NoteMarkdown.tsx')));
    assert.ok(!catalog.entries.some(row => row.locations.some(location => location.source.endsWith('/LiveMarkdownEditor.tsx'))));
    assert.ok(catalog.native.find(row => row.property === 'lineSpacing' && row.value === '6').locations.some(location => location.source.endsWith('/NativeDesignedPanel.swift')));
    assert.ok(catalog.native.some(row => row.value === '.system(size: bodyFontSize)'));
    assert.ok(!catalog.native.some(row => row.value === '.title2.bold()'), 'DEBUG-only preview rules stay outside the production list');
    await utimes(outputPath, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtime = (await stat(outputPath)).mtimeMs;
    await buildProjectTypographyCatalog({ outputPath });
    await buildProjectTypographyCatalog({ outputPath, check: true });
    assert.equal((await stat(outputPath)).mtimeMs, mtime);
    await writeFile(outputPath, 'manual catalog');
    await assert.rejects(buildProjectTypographyCatalog({ outputPath, check: true }), /catalog is stale/);
    assert.equal(await readFile(outputPath, 'utf8'), 'manual catalog');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('native definitions preserve nested expressions, platform conditions and production alternatives', () => {
  const entries = collectNativeTypography(new Map([['native.swift', `
    // Text().font(.largeTitle)
    let text = "Text().font(.caption2)"
    #if DEBUG
      Text().font(.title2.bold())
    #else
      Text().font(.headline)
    #endif
    #if os(iOS)
      Text().font(.system(size: size == 44 ? 20 : 16)).fontWeight(selected ? .medium : .regular).lineSpacing(6)
    #endif
  `]]));
  assert.deepEqual(entries.map(row => [row.property, row.value]), [['font', '.headline'], ['font', '.system(size: size == 44 ? 20 : 16)'], ['fontWeight', 'selected ? .medium : .regular'], ['lineSpacing', '6']]);
});

test('expands the current token-based font shorthand without dropping line height or family', async () => {
  const result = await collectTypographyUsage(new Map([['current.css', '.code {font: var(--font-size-sm)/var(--text-supporting-leading) var(--font-family-code);}']]), theme);
  for (const [property, value] of [['font-family','var(--font-family-code)'],['font-size','var(--font-size-sm)'],['line-height','var(--text-supporting-leading)']]) assert.ok(result.entries.some(row => row.property === property && row.value === value));
});
