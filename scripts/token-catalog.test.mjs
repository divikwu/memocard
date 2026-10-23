import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokenCatalog, inspectCSSTokens, inspectRuntimeTokens, checkPublicPlacement, checkSourcePath } from './build-token-catalog.mjs';
import { inspectConsumerText, checkConsumerReferences } from './token-consumers.mjs';
import { IOS_PALETTE_KEYS } from '../apps/ui/src/lib/ios-palette.ts';

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
  assert.throws(() => inspectRuntimeTokens(code, { '--note-size': outputs['--note-size'] }, 'preferences.tsx'), /Unregistered runtime token/);
  assert.throws(() => inspectRuntimeTokens(code, { ...outputs, '--unused': outputs['--note-size'] }, 'preferences.tsx'), /Missing runtime output/);
  assert.throws(() => inspectRuntimeTokens(code, { ...outputs, '--app-font': { type: 'fontFamily', unit: 'px' } }, 'preferences.tsx'), /Invalid runtime token type\/unit/);
});

test('production coverage is complete, preserves mtimes and checks drift without overwriting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-token-catalog-'));
  try {
    const outputPath = join(directory, 'coverage.md'), options = { outputPath };
    const result = await buildTokenCatalog(options);
    assert.equal(result.categories, 9);
    assert.equal(result.portable, 28);
    assert.equal(result.runtime, 13);
    assert.ok(result.consumerFiles > 90);
    assert.equal(result.nativeConsumerFiles, 2);
    assert.ok(result.css > 100);
    const content = await readFile(outputPath, 'utf8');
    const jsonPath = outputPath.replace(/\.md$/, '.json');
    const catalog = JSON.parse(await readFile(jsonPath, 'utf8'));
    assert.equal(catalog.css.length, result.css);
    assert.equal(catalog.css.filter(token => token.id === 'color.data').length, 56);
    assert.equal(catalog.css.filter(token => ['color.syntax', 'color.syntax-background'].includes(token.id)).length, 19);
    assert.equal(catalog.optionalStylesheets.length, 2);
    assert.ok(!content.split('## 生产源码消费索引')[1].split('## 组件 平台 与上游所有权')[0].includes('--data-categorical-blue'), 'Optional data values are not reported as production consumers');
    assert.equal(catalog.runtime.length, result.runtime);
    assert.equal(catalog.portable.length, result.portable);
    assert.ok(catalog.css.every(token => token.declarations.length && token.source && token.type));
    for (const role of ['text', 'swatch']) {
      const callouts = catalog.css.filter(token => token.id === `color.callout-${role}`);
      assert.deepEqual(callouts.map(token => token.name).sort(), ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'].map(color => `--callout-${role}-${color}`).sort());
      assert.ok(callouts.every(token => token.source === 'apps/ui/src/import-layout.tokens.css' && token.status === 'active' && token.type === 'color'));
      assert.ok(callouts.every(token => token.declarations.length === (role === 'text' ? 2 : 1)));
    }
    const motion = catalog.css.filter(token => token.category === 'motion' && token.layer !== 'adapter');
    assert.equal(motion.length, 11);
    assert.ok(motion.every(token => token.source === 'apps/ui/src/features/motion/tokens.css' && token.status === 'active'));
    assert.equal(motion.find(token => token.name === '--motion-ease-out').declarations[0].value, 'ease-out');
    const shadows = catalog.css.filter(token => ['effects.project-shadows', 'effects.capture-shadows'].includes(token.id));
    assert.deepEqual(shadows.map(token => token.name), ['--control-shadow', '--floating-control-shadow', '--surface-focus-shadow', '--surface-shadow']);
    assert.ok(shadows.every(token => token.source === `apps/ui/src/features/theme/${token.id === 'effects.capture-shadows' ? 'capture.tokens' : 'tokens'}.css` && token.status === (token.id === 'effects.capture-shadows' ? 'active' : 'alias') && token.type === 'shadow'));
    assert.ok(shadows.every(token => token.declarations.length === (['--surface-focus-shadow', '--floating-control-shadow'].includes(token.name) ? 2 : 1)));
    await utimes(jsonPath, new Date('2001-01-01'), new Date('2001-01-01'));
    const jsonMtime = (await stat(jsonPath)).mtimeMs;
    for (const status of ['reserved', 'baseline-only', 'platform-owned']) assert.ok(content.includes(status));
    for (const [path, token] of [['TagPill.tsx', '--tag-default-fg'], ['MermaidPreview.tsx', '--secondary'], ['ios-app-chrome.tsx', 'radius.none'], ['WebView.swift', '--ios-top'], ['select.tsx', '--anchor-width'], ['nav-actions.tsx', '--accent-foreground'], ['import-layout.css', '--callout-text-gray'], ['CalloutColorsMenu.tsx', '--callout-swatch-gray'], ['quick-capture.tsx', '--shadow-med'], ['loading-states.tsx', '--shadow-med'], ['note-collection-layout.ts', '--shadow-med'], ['quick-capture.css', '--surface-focus-shadow'], ['quick-capture.css', '--shadow-low'], ['quick-capture.css', '--floating-control-shadow'], ['mobile-tag-actions.css', '--shadow-low']]) {
      assert.ok(content.split('\n').some(line => line.startsWith('| [') && line.includes(path) && line.includes(`\`${token}\``)), `${path} consumes ${token}`);
    }
    await utimes(outputPath, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtime = (await stat(outputPath)).mtimeMs;
    await buildTokenCatalog(options);
    await buildTokenCatalog({ ...options, check: true });
    assert.equal((await stat(outputPath)).mtimeMs, mtime);
    assert.equal((await stat(jsonPath)).mtimeMs, jsonMtime);
    await writeFile(jsonPath, 'manual catalog');
    await assert.rejects(buildTokenCatalog({ ...options, check: true }), /Storybook token catalog is stale/);
    assert.equal(await readFile(jsonPath, 'utf8'), 'manual catalog');
    await buildTokenCatalog(options);
    await writeFile(outputPath, 'manual change');
    await assert.rejects(buildTokenCatalog({ ...options, check: true }), /stale/);
    assert.equal(await readFile(outputPath, 'utf8'), 'manual change');
    const registry = JSON.parse(await readFile(new URL('../design/tokens/registry.json', import.meta.url), 'utf8'));
    assert.deepEqual(registry.dynamicConsumers.find(entry => entry.source.endsWith('/ios-palette.ts')).tokens, IOS_PALETTE_KEYS.map(key => `--${key}`));
    const registryPath = join(directory, 'registry.json');
    for (const [owned, error, families = registry.families] of [
      [registry.owned.map(entry => entry.category === 'motion' ? { ...entry, category: 'effects' } : entry), /Uncovered token category: motion/, registry.families.map(entry => entry.category === 'motion' ? { ...entry, category: 'effects' } : entry)],
      [[...registry.owned, registry.owned[0]], /Duplicate token contract/],
      [[{ ...registry.owned[0], sources: ['missing-source.css'] }, ...registry.owned.slice(1)], /ENOENT/],
    ]) {
      await writeFile(registryPath, JSON.stringify({ ...registry, owned, families }));
      await assert.rejects(buildTokenCatalog({ ...options, registryPath }), error);
    }
    for (const [change, error] of [
      [{ optionalStylesheets: [] }, /Unreachable token CSS/],
      [{ optionalStylesheets: [null] }, /Invalid optional stylesheet entry/],
      [{ optionalStylesheets: [...registry.optionalStylesheets, ...registry.optionalStylesheets] }, /Invalid optional stylesheet entry/],
      [{ optionalStylesheets: [{ ...registry.optionalStylesheets[0], source: registry.families[0].source }] }, /already production-reachable/],
      [{ optionalStylesheets: [{ ...registry.optionalStylesheets[0], verification: 'missing.browser.tsx' }] }, /ENOENT/],
      [{ dynamicConsumers: [] }, /Unbounded dynamic token read/],
      [{ externalSources: [] }, /Unknown consumer reference/],
      [{ runtimeSources: registry.runtimeSources.filter(entry => !entry.format) }, /Unknown consumer reference/],
      [{ owned: registry.owned.map(entry => ({ ...entry, sources: entry.sources.filter(path => !path.endsWith('/date-property-picker.css')) })) }, /Unowned production stylesheet/],
      [{ families: registry.families.map(entry => entry.id === 'effects.elevation' ? { ...entry, status: 'reserved' } : entry) }, /Reserved token has a production consumer/],
    ]) {
      await writeFile(registryPath, JSON.stringify({ ...registry, ...change }));
      await assert.rejects(buildTokenCatalog({ ...options, registryPath }), error);
    }
    const source = registry.families[0].source, unreachable = join(directory, 'unreachable.css');
    await writeFile(unreachable, await readFile(new URL(`../${source}`, import.meta.url), 'utf8'));
    await writeFile(registryPath, JSON.stringify({ ...registry, families: registry.families.map(entry => entry.source === source ? { ...entry, source: unreachable } : entry) }));
    await assert.rejects(buildTokenCatalog({ ...options, registryPath }), /Unreachable token CSS/);
    const syntaxSource = registry.optionalStylesheets.find(entry => entry.source.endsWith('/syntax.css')).source;
    const brokenImport = join(directory, 'syntax.css');
    await writeFile(brokenImport, (await readFile(new URL(`../${syntaxSource}`, import.meta.url), 'utf8')).replace('./code.css', './missing.css'));
    await writeFile(registryPath, JSON.stringify({
      ...registry,
      families: registry.families.map(entry => entry.source === syntaxSource ? { ...entry, source: brokenImport } : entry),
      optionalStylesheets: registry.optionalStylesheets.map(entry => entry.source === syntaxSource ? { ...entry, source: brokenImport } : entry),
    }));
    await assert.rejects(buildTokenCatalog({ ...options, registryPath }), /Unregistered optional CSS import/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('one seven-step scale feeds eight complete text styles; old names are adapters', async () => {
  const registry = JSON.parse(await readFile(new URL('../design/tokens/registry.json', import.meta.url), 'utf8'));
  const families = registry.families.filter(family => /typography\/(?:tokens|scale.generated)\.css$/.test(family.source));
  const sources = new Map(await Promise.all([...new Set(families.map(family => family.source))].map(async path => [path, await readFile(new URL(`../${path}`, import.meta.url), 'utf8')])));
  const theme = await readFile(new URL('../apps/ui/node_modules/tailwindcss/theme.css', import.meta.url), 'utf8');
  const records = inspectCSSTokens(families, sources, [...theme.matchAll(/(--[\w-]+):/g)].map(match => match[1]));
  const sizes = records.filter(token => token.family.id === 'typography.size-scale');
  assert.deepEqual(sizes.map(token => token.declarations[0].value).sort((a, b) => parseFloat(a) - parseFloat(b)), ['0.75rem', '0.875rem', '1rem', '1.125rem', '1.25rem', '1.5rem', '2rem']);
  const leading = records.filter(token => token.family.id === 'typography.leading-strategies');
  assert.deepEqual(leading.map(token => token.declarations[0].value).sort(), ['1.25', '1.5', '1.75']);
  assert.ok(records.filter(token => token.family.id === 'typography.line-scale').every(token => token.family.layer === 'adapter'));
  assert.equal(records.find(token => token.name === '--font-weight-bold').declarations[0].value, 'var(--font-weight-semibold)');
  const { fontWeights } = await import('../apps/ui/src/features/typography/scale.ts');
  const weights = records.filter(token => token.family.id === 'typography.weight-scale');
  assert.equal(weights.length, 3);
  for (const [name, value] of Object.entries(fontWeights)) assert.equal(weights.find(token => token.name === `--font-weight-${name}`).declarations[0].value, String(value));
  const roles = records.filter(token => ['typography.text-sizes', 'typography.text-metrics'].includes(token.family.id));
  assert.equal(roles.length, 24);
  for (const role of ['title', 'heading', 'subheading', 'large', 'body', 'label', 'supporting', 'code']) assert.deepEqual(roles.filter(token => token.name.startsWith(`--text-${role}-`)).map(token => token.name.split('-').at(-1)).sort(), ['leading', 'size', 'weight']);
  const compatibility = records.filter(token => ['typography.content-dimensions', 'typography.content-numbers', 'typography.fixed-sizes'].includes(token.family.id));
  assert.equal(compatibility.length, 25);
  assert.ok(compatibility.every(token => token.family.layer === 'adapter' && token.family.status === 'alias'));
  const consumers = (await Promise.all(['styles.css', 'typeset.css', 'components/note-search-dialog.css'].map(file => readFile(new URL(`../apps/ui/src/${file}`, import.meta.url), 'utf8')))).join('\n');
  assert.ok(compatibility.every(token => !consumers.includes(`var(${token.name})`)));
});


test('optional domains compile independently and do not create utilities without their import', async () => {
  const { compile } = createRequire(new URL('../apps/ui/package.json', import.meta.url))('tailwindcss');
  const core = (await Promise.all(['tokens.css', 'hues.css', 'domains/code.css'].map(path => readFile(new URL(`../apps/ui/src/features/theme/${path}`, import.meta.url), 'utf8')))).join('\n');
  const base = await compile(`${core}\n@tailwind utilities;`);
  const withoutImport = base.build(['bg-body', 'bg-syntax-background', 'fill-data-categorical-blue', 'text-syntax-keyword']);
  assert.ok(withoutImport.includes('.bg-body') && withoutImport.includes('.bg-syntax-background'));
  assert.ok(!withoutImport.includes('.fill-data-categorical-blue') && !withoutImport.includes('.text-syntax-keyword'));
  for (const [domain, count, utility] of [['data', 56, 'fill'], ['syntax', 19, 'text']]) {
    const source = await readFile(new URL(`../apps/ui/src/features/theme/domains/${domain}.css`, import.meta.url), 'utf8');
    const codeBackground = domain === 'syntax' ? await readFile(new URL('../apps/ui/src/features/theme/domains/code.css', import.meta.url), 'utf8') : '';
    const aliases = [...(source + codeBackground).matchAll(/--color-([\w-]+):\s*var\((--[\w-]+)\);/g)];
    assert.equal(aliases.length, count);
    const compiler = await compile(`${source}\n@tailwind utilities;`, {
      base: fileURLToPath(new URL('../apps/ui/src/features/theme/domains/', import.meta.url)),
      async loadStylesheet(id, base) {
        const path = resolve(base, id);
        return { path, base: dirname(path), content: await readFile(path, 'utf8') };
      },
    });
    const output = compiler.build(aliases.map(([, name]) => `${utility}-${name}`));
    for (const [, name, variable] of aliases) {
      assert.ok(output.includes(`.${utility}-${name} {`), `${name} produces a class`);
      assert.ok(output.includes(`${utility === 'fill' ? 'fill' : 'color'}: var(${variable})`), `${name} reads its owning role`);
    }
  }
});

test('non-color Tailwind interfaces retain upstream fallbacks and use project-owned roles', async () => {
  const requireUI = createRequire(new URL('../apps/ui/package.json', import.meta.url));
  const { compile } = requireUI('tailwindcss');
  const paths = [requireUI.resolve('tailwindcss/theme.css'), ...['theme/tokens.css', 'typography/scale.generated.css', 'motion/tokens.css'].map(path => fileURLToPath(new URL(`../apps/ui/src/features/${path}`, import.meta.url)))];
  const source = (await Promise.all(paths.map(path => readFile(path, 'utf8')))).join('\n');
  const compiler = await compile(`${source}\n@tailwind utilities;`);
  const names = ['font-sans', 'font-heading', 'font-mono', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'rounded-none', 'rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-full', 'p-4', 'gap-2', 'transition-colors', 'transition-opacity', 'transition-shadow', 'transition-transform', 'ease-out'];
  const output = compiler.build([...names, 'text-2xs']);
  for (const name of names) assert.ok(output.includes(`.${name} {`), `${name} compiles`);
  assert.ok(output.includes('font-family: var(--app-font-mono)'));
  assert.ok(output.includes('transition-duration: var(--tw-duration, var(--motion-duration-fast))'));
  assert.ok(output.includes('transition-property: transform, translate, scale, rotate'));
  assert.ok(!output.includes('.text-2xs {'), 'No implicit eighth project font size is introduced');
});
