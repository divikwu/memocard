import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokenCatalog, inspectCSSTokens, inspectRuntimeTokens, checkPublicPlacement, checkSourcePath } from './build-token-catalog.mjs';
import { inspectConsumerText, checkConsumerReferences } from './token-consumers.mjs';

const family = { id: 'color.test', source: 'tokens.css', pattern: '^--(surface|text)$', category: 'color', layer: 'semantic', type: 'color', status: 'active', axes: ['mode'], description: 'Theme colors', consumers: ['button.tsx'] };
const inspect = (css, families = [family], upstream = []) => inspectCSSTokens(families, new Map([['tokens.css', css]]), upstream);

test('rejects filename casing errors even on case-insensitive development filesystems', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'token-path-case-'));
  try {
    await writeFile(join(directory, 'markdown.tsx'), 'export {};');
    await checkSourcePath(join(directory, 'markdown.tsx'));
    await assert.rejects(checkSourcePath(join(directory, 'Markdown.tsx')), /filename case mismatch|ENOENT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('collects declarations, preserves mode overrides, and resolves registered or upstream aliases', () => {
  const records = inspect('/* --fake: red; */ :root { --surface: var(--color-white); --text: #111; } .dark { --surface: #111; --text: var(--color-white); }', [family], ['--color-white']);
  assert.deepEqual(records.map(record => record.name), ['--surface', '--text']);
  assert.deepEqual(records[0].declarations.map(({ scope, value }) => [scope, value]), [[':root', 'var(--color-white)'], ['.dark', '#111']]);
});

test('rejects unregistered names, overlapping owners, duplicate definitions and empty families', () => {
  assert.throws(() => inspect(':root { --surface: white; --forgotten: red; }'), /Unregistered CSS token/);
  assert.throws(() => inspect(':root { --surface: white; }', [family, { ...family, id: 'color.other' }]), /Ambiguous CSS token/);
  assert.throws(() => inspect(':root { --surface: white; --surface: red; }'), /Duplicate CSS definition/);
  assert.throws(() => inspect(':root { color: red; }'), /Empty token family/);
});

test('theme namespace resets are compiler configuration while runtime wildcards still fail registration', () => {
  assert.deepEqual(inspect(':root { --surface: white; } @theme reference inline { --shadow-*: initial; }').map(record => record.name), ['--surface']);
  assert.throws(() => inspect(':root { --surface: white; --shadow-*: initial; }'), /Unregistered CSS token/);
  assert.throws(() => inspect(':root { --surface: white; } @theme reference inline { --shadow-*: white; }'), /Unregistered CSS token/);
});

test('rejects unknown references and cycles in the defaults or an authored mode', () => {
  assert.throws(() => inspect(':root { --surface: var(--typo); }'), /Unknown CSS reference/);
  assert.throws(() => inspect(':root { --surface: var(--text); --text: var(--surface); }'), /Cyclic CSS alias/);
  assert.throws(() => inspect(':root { --surface: white; --text: black; } .dark { --surface: var(--text); --text: var(--surface); }'), /Cyclic CSS alias/);
});

test('requires valid types, status, axes and consumers', () => {
  for (const change of [{ type: 'anything' }, { status: 'complete' }, { axes: ['unknown'] }, { consumers: [] }, { description: '' }]) {
    assert.throws(() => inspect(':root { --surface: white; }', [{ ...family, ...change }]), /Invalid token metadata/);
  }
});

test('keeps public definitions in registered sources and allows component-local variables', () => {
  for (const css of [':root { --surface: white; }', '.dark { --surface: black; }', ':root.dark[data-palette="mono"] { --surface: black; }', '@theme inline { --color-body: red; }', 'html { --surface: white; }', 'body { --surface: white; }', ':where(:root) { --surface: white; }', '.dark[data-mode="x"] { --surface: black; }', '@property --surface { syntax: "<color>"; inherits: true; initial-value: white; }']) {
    assert.throws(() => checkPublicPlacement(css, 'styles.css'), /outside registered sources/);
  }
  assert.doesNotThrow(() => checkPublicPlacement('.editor { --local: 1px; } .dark .editor { --local: 2px; } :root { font-synthesis: none; }', 'editor.css'));
});

test('registers native safe-area writes embedded in Swift without executing them', () => {
  const source = 'webView.callAsyncJavaScript("document.documentElement.style.setProperty(\'--ios-top\', top + \'px\');", arguments: [:])';
  const tokens = { '--ios-top': { type: 'dimension', unit: 'px' } };
  assert.doesNotThrow(() => inspectRuntimeTokens(source, tokens, 'WebView.swift', 'swift-javascript'));
  assert.throws(() => inspectRuntimeTokens(source, {}, 'WebView.swift', 'swift-javascript'), /Unregistered runtime token/);
  assert.throws(() => inspectRuntimeTokens('// No bridge script', tokens, 'WebView.swift', 'swift-javascript'), /Missing embedded JavaScript/);
});

test('expands bounded dynamic consumers and rejects unregistered dynamic or static references', () => {
  const names = new Set(['--tag-blue-bg', '--tag-red-bg', '--foreground']);
  assert.deepEqual(inspectConsumerText('var(--tag-${color}-bg) var(--foreground)', names), [...names].sort());
  assert.deepEqual(inspectConsumerText('---${newline}${yaml}${newline}---', names), []);
  assert.throws(() => inspectConsumerText('getPropertyValue(`--${key}`)', names), /Unbounded dynamic token read/);
  assert.deepEqual(inspectConsumerText('getPropertyValue(`--${key}`)', names, ['--foreground']), ['--foreground']);
  assert.throws(() => inspectConsumerText('var(--removed-${color}-bg)', names), /Unknown dynamic token reference/);
  assert.throws(() => checkConsumerReferences('var(--missing, red)', names, 'editor.css'), /Unknown consumer reference/);
  assert.throws(() => checkConsumerReferences('w-(--missing)', names, 'button.tsx'), /Unknown consumer reference/);
  assert.doesNotThrow(() => checkConsumerReferences('var(--foreground)', names, 'editor.css'));
});

test('checks runtime preference outputs without treating comments or plain strings as definitions', () => {
  const code = '/* --fake: 10px */ const hint = "--not-a-definition"; const vars = { "--note-size": `${size}px` }; root.style.setProperty("--app-font", family);';
  const outputs = { '--note-size': { type: 'dimension', unit: 'px' }, '--app-font': { type: 'fontFamily', unit: null } };
  assert.doesNotThrow(() => inspectRuntimeTokens(code, outputs, 'preferences.tsx'));
  assert.doesNotThrow(() => inspectRuntimeTokens('root.style.setProperty("--note-leading", leading)', { '--note-leading': { type: 'number', unit: null } }, 'preferences.tsx'));
  const flow = 'const vars = { "--note-flow": value };';
  assert.doesNotThrow(() => inspectRuntimeTokens(flow, { '--note-flow': { type: 'dimension', unit: ['px', 'rem'] } }, 'preferences.tsx'));
  for (const unit of [[], ['px', 'px'], ['rem', 'invalid']]) assert.throws(() => inspectRuntimeTokens(flow, { '--note-flow': { type: 'dimension', unit } }, 'preferences.tsx'), /Invalid runtime token type\/unit/);
  assert.throws(() => inspectRuntimeTokens(code, { '--note-size': outputs['--note-size'] }, 'preferences.tsx'), /Unregistered runtime token/);
  assert.throws(() => inspectRuntimeTokens(code, { ...outputs, '--unused': outputs['--note-size'] }, 'preferences.tsx'), /Missing runtime output/);
  assert.throws(() => inspectRuntimeTokens(code, { ...outputs, '--app-font': { type: 'fontFamily', unit: 'px' } }, 'preferences.tsx'), /Invalid runtime token type\/unit/);
});

test('production coverage follows the current UI, preserves mtimes and refuses drift', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-token-catalog-'));
  try {
    const outputPath = join(directory, 'coverage.md'), options = { outputPath };
    const result = await buildTokenCatalog(options);
    assert.equal(result.categories, 9);
    assert.equal(result.portable, 28);
    assert.equal(result.runtime, 17);
    assert.ok(result.consumerFiles > 90);
    assert.equal(result.nativeConsumerFiles, 2);
    assert.ok(result.css > 300);
    const content = await readFile(outputPath, 'utf8'), jsonPath = outputPath.replace(/\.md$/, '.json');
    const catalog = JSON.parse(await readFile(jsonPath, 'utf8'));
    assert.equal(catalog.css.length, result.css);
    assert.equal(catalog.runtime.length, result.runtime);
    assert.deepEqual(catalog.runtime.find(token => token.name === '--note-flow').unit, ['px', 'rem']);
    for (const name of ['--note-body-font', '--note-heading-font', '--note-mono-font', '--note-scale']) assert.ok(!catalog.runtime.some(token => token.name === name));
    for (const name of ['--note-line-height', ...[1, 2, 3].flatMap(level => [`--note-h${level}-size`, `--note-h${level}-line-height`])]) assert.ok(catalog.runtime.some(token => token.name === name));
    assert.equal(catalog.portable.length, result.portable);
    assert.equal(catalog.optionalStylesheets.length, 0);
    assert.ok(catalog.css.every(token => token.declarations.length && token.source.startsWith('apps/ui/ui/') && token.type));
    assert.ok(catalog.css.find(token => token.name === '--color-accent').declarations.some(declaration => declaration.source.endsWith('/web-palette.css')));
    assert.ok(catalog.css.find(token => token.name === '--radius-element').declarations.some(declaration => declaration.source.endsWith('/preview-appearance.css')));
    assert.ok(catalog.css.find(token => token.name === '--color-brand').status === 'reserved');
    for (const [path, token] of [['TagColorStyles.core.tsx', '--tag-default-fg'], ['NoteMarkdown.tsx', '--color-background-body'], ['WebView.swift', '--ios-top'], ['select.tsx', '--anchor-width'], ['QuickCapture.tsx', '--shadow-flat'], ['QuickCapture.css', '--shadow-scale-2']]) {
      assert.ok(content.split('\n').some(line => line.startsWith('| [') && line.includes(path) && line.includes(`\`${token}\``)), `${path} consumes ${token}`);
    }
    assert.ok(!content.includes('/src/components/ui/') && !content.includes('/apps/ui/stories/'));
    for (const path of [outputPath, jsonPath]) await utimes(path, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtimes = await Promise.all([outputPath, jsonPath].map(async path => (await stat(path)).mtimeMs));
    await buildTokenCatalog(options);
    await buildTokenCatalog({ ...options, check: true });
    assert.deepEqual(await Promise.all([outputPath, jsonPath].map(async path => (await stat(path)).mtimeMs)), mtimes);
    await writeFile(jsonPath, 'manual catalog');
    await assert.rejects(buildTokenCatalog({ ...options, check: true }), /Storybook token catalog is stale/);
    assert.equal(await readFile(jsonPath, 'utf8'), 'manual catalog');
    await buildTokenCatalog(options);
    await writeFile(outputPath, 'manual change');
    await assert.rejects(buildTokenCatalog({ ...options, check: true }), /stale/);
    assert.equal(await readFile(outputPath, 'utf8'), 'manual change');
    const registry = JSON.parse(await readFile(new URL('../design/tokens/registry.json', import.meta.url), 'utf8'));
    const registryPath = join(directory, 'registry.json');
    for (const [change, error] of [
      [{ owned: [...registry.owned, registry.owned[0]] }, /Duplicate token contract/],
      [{ owned: [{ ...registry.owned[0], sources: ['missing-source.css'] }, ...registry.owned.slice(1)] }, /ENOENT/],
      [{ optionalStylesheets: [null] }, /Invalid optional stylesheet entry/],
      [{ dynamicConsumers: [] }, /Unbounded dynamic token read/],
      [{ externalSources: [] }, /Unknown consumer reference/],
      [{ runtimeSources: registry.runtimeSources.filter(entry => !entry.source.endsWith('/preview-mode.tsx')) }, /Unknown CSS reference/],
      [{ owned: registry.owned.map(entry => ({ ...entry, sources: entry.sources.filter(path => !path.endsWith('/sheet-swipe.css')) })) }, /Unowned production stylesheet/],
      [{ families: registry.families.map(entry => entry.id === 'effects.elevation' ? { ...entry, status: 'reserved' } : entry) }, /Reserved token has a production consumer/],
      [{ owned: registry.owned.map(entry => entry.category === 'motion' ? { ...entry, category: 'effects' } : entry), families: registry.families.map(entry => entry.category === 'motion' ? { ...entry, category: 'effects' } : entry) }, /Uncovered token category: motion/],
    ]) {
      await writeFile(registryPath, JSON.stringify({ ...registry, ...change }));
      await assert.rejects(buildTokenCatalog({ ...options, registryPath }), error);
    }
    const source = registry.families[0].source, unreachable = join(directory, 'unreachable.css');
    await writeFile(unreachable, await readFile(new URL(`../${source}`, import.meta.url), 'utf8'));
    await writeFile(registryPath, JSON.stringify({ ...registry, families: registry.families.map(entry => entry.source === source ? { ...entry, source: unreachable } : entry) }));
    await assert.rejects(buildTokenCatalog({ ...options, registryPath }), /Unreachable token CSS/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('explicit stylesheet overrides keep one owner and reference aliases do not invent runtime cycles', () => {
  const sources = new Map([['tokens.css', ':root {--surface:white;--text:black;} @theme reference inline {--surface:var(--surface);}'], ['palette.css', ':root {--surface:blue;}']]);
  const records = inspectCSSTokens([{...family,overrides:['palette.css']}], sources);
  assert.equal(records.find(record => record.name === '--surface').declarations.length, 3);
  assert.throws(() => inspectCSSTokens([family], sources), /Unregistered CSS token/);
  assert.throws(() => inspect(':root {--surface:var(--surface);--text:black;}'), /Cyclic CSS alias/);
  assert.throws(() => checkPublicPlacement('.ui-theme {--forgotten:red;}', 'current.css'), /outside registered sources/);
});

test('current semantic utilities compile while retired aliases and primitive scales stay private', async () => {
  const require = createRequire(new URL('../apps/ui/package.json', import.meta.url));
  const { compile } = require('tailwindcss');
  const source = (await Promise.all([require.resolve('tailwindcss/theme.css'), fileURLToPath(new URL('../apps/ui/ui/theme.css', import.meta.url))].map(path => readFile(path, 'utf8')))).join('\n');
  const compiler = await compile(`${source}\n@tailwind utilities;`);
  const names = ['bg-body','text-primary','text-control-secondary','font-sans','font-heading','font-mono','font-bold','text-sm','text-3xl','text-4xl','rounded-element','rounded-container','p-4','gap-2','transition-colors','duration-fast','ease-standard'];
  names.push('shadow-flat','shadow-low','shadow-med','shadow-high','shadow-control','shadow-floating','shadow-document','shadow-card-hover','shadow-input-focus');
  const retired = ['2xs','xs','sm','md','lg','xl','2xl'].map(size => `shadow-${size}`);
  const primitives = [0, 1, 2, 3, 4].map(level => `shadow-scale-${level}`);
  const reserved = ['hover', 'selected', 'success', 'warning', 'error'].map(state => `shadow-inset-${state}`);
  const output = compiler.build([...names, ...retired, ...primitives, ...reserved]);
  for (const name of names) assert.ok(output.includes(`.${name} {`), `${name} compiles`);
  for (const name of retired) {
    assert.ok(!output.includes(`.${name} {`), `${name} cannot fall back to Tailwind defaults`);
    assert.ok(!output.includes(`--${name}:`), `${name} has no theme alias`);
  }
  for (const name of [...primitives, ...reserved]) assert.ok(!output.includes(`.${name} {`), `${name} stays outside the component API`);
  assert.ok(output.includes('font-family: var(--font-family-code)'));
  assert.ok(output.includes('transition-duration: var(--duration-fast)'));
  assert.ok(output.includes('background-color: var(--color-background-body)'));
});
