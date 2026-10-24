import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, symlink, cp, readFile, writeFile, rm, stat, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTokenCatalog } from './build-token-catalog.mjs';
import { tmpdir } from 'node:os';
import { buildTheme, readTheme } from './build-theme.mjs';
import { buildThemeContract } from './build-theme-contract.mjs';

const root = new URL('../', import.meta.url);
test('the checked-in inherited example is reproducible and standalone', async () => {
  const theme = await buildTheme({ inputPath: new URL('design/themes/ocean.json', root).pathname, outputPath: new URL('design/themes/ocean.generated.css', root).pathname, check: true });
  assert.ok(theme.cssText.includes('data-memocard-theme="ocean"'));
  assert.ok(!theme.cssText.includes('data-memocard-theme="ocean-base"'));
  assert.ok(theme.tokens['--primary'] && theme.localTokens['--brand-emphasis']);
});
test('JSON build preserves mtimes, detects drift without overwriting, and rejects inheritance loops', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-theme-'));
  try {
    const base = join(directory, 'base.json'), child = join(directory, 'child.json'), css = join(directory, 'theme.css');
    await writeFile(base, JSON.stringify({ name: 'base', tokens: { '--primary': ['#123456', '#abcdef'] } }));
    await writeFile(child, JSON.stringify({ name: 'child', extends: './base.json', tokens: { '--foreground': '#112233' } }));
    await buildTheme({ inputPath: child, outputPath: css });
    await utimes(css, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtime = (await stat(css)).mtimeMs;
    await buildTheme({ inputPath: child, outputPath: css });
    await buildTheme({ inputPath: child, outputPath: css, check: true });
    assert.equal((await stat(css)).mtimeMs, mtime);
    await writeFile(css, 'manual CSS');
    await assert.rejects(buildTheme({ inputPath: child, outputPath: css, check: true }), /stale/);
    assert.equal(await readFile(css, 'utf8'), 'manual CSS');
    await writeFile(base, JSON.stringify({ name: 'base', extends: './child.json' }));
    await assert.rejects(readTheme(child), /Cyclic theme file inheritance/);
    assert.equal(await readFile(css, 'utf8'), 'manual CSS');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('generated writable-token contracts are deterministic and cannot drift silently', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-theme-contract-'));
  try {
    const outputPath = join(directory, 'contract.ts');
    const result = await buildThemeContract({ outputPath });
    assert.ok(result.tokens > 300 && result.references > result.tokens);
    const content = await readFile(outputPath, 'utf8');
    assert.ok(content.includes('"--radius"') && content.includes('"--line-height-xs"'));
    await utimes(outputPath, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtime = (await stat(outputPath)).mtimeMs;
    await buildThemeContract({ outputPath, check: true });
    assert.equal((await stat(outputPath)).mtimeMs, mtime);
    await writeFile(outputPath, 'manual contract');
    await assert.rejects(buildThemeContract({ outputPath, check: true }), /stale/);
    assert.equal(await readFile(outputPath, 'utf8'), 'manual contract');
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('a production runtime theme indexes declarations and still rejects real reserved or unknown reads', async () => {
  const repo = fileURLToPath(root), directory = await mkdtemp(join(tmpdir(), 'memocard-runtime-theme-'));
  try {
    for (const name of ['design', 'scripts', 'packages']) await symlink(join(repo, name), join(directory, name));
    await mkdir(join(directory, 'apps/ui'), { recursive: true });
    for (const name of await readdir(join(repo, 'apps'))) if (name !== 'ui') await symlink(join(repo, 'apps', name), join(directory, 'apps', name));
    for (const name of await readdir(join(repo, 'apps/ui'))) {
      if (name === 'src') await cp(join(repo, 'apps/ui/src'), join(directory, 'apps/ui/src'), { recursive: true });
      else await symlink(join(repo, 'apps/ui', name), join(directory, 'apps/ui', name));
    }
    const main = join(directory, 'apps/ui/src/main.tsx');
    const source = `import {defineTheme} from './features/theme/define-theme';
const runtimeTheme=defineTheme({name:'runtime-probe',color:{accent:'#0064E0'},localTokens:{'--integration-brand':'#123456'},tokens:{'--primary':'var(--integration-brand)'}});
` + (await readFile(main, 'utf8')).replace('<ThemeProvider>', '<ThemeProvider definition={runtimeTheme}>');
    await writeFile(main, source);
    const options = { root: directory, outputPath: join(directory, 'coverage.md') };
    await buildTokenCatalog(options);
    const catalog = JSON.parse(await readFile(join(directory, 'coverage.json'), 'utf8'));
    assert.equal(catalog.css.filter(token => token.status === 'reserved').length > 50, true);
    const coverage = await readFile(options.outputPath, 'utf8');
    const producerRow = coverage.split('\n').find(line => line.startsWith('| [') && line.includes('/define-theme.ts)'));
    assert.ok(producerRow?.includes('`--syntax-keyword`'), 'Generated names are indexed as declarations');
    assert.ok(!coverage.includes('| [apps/ui/src/generated/theme-contract.ts]'), 'Generated contract metadata is not a component consumer');
    const producer = join(directory, 'apps/ui/src/features/theme/define-theme.ts'), original = await readFile(producer, 'utf8');
    await writeFile(producer, original + '\nconst accidentalConsumer = "var(--chart-1)";');
    await assert.rejects(buildTokenCatalog(options), /Reserved token has a production consumer/);
    await writeFile(producer, original);
    await writeFile(main, source + '\nconst unknown = "var(--undeclared-color)";');
    await assert.rejects(buildTokenCatalog(options), /Unknown consumer reference/);
    await writeFile(main, source);
    const registry = JSON.parse(await readFile(new URL('design/tokens/registry.json', root), 'utf8'));
    const registryPath = join(directory, 'registry.json');
    for (const [dynamicProducers, error] of [
      [[], /Reserved token has a production consumer/],
      [registry.dynamicProducers.map(entry => ({ ...entry, pattern: '^--chart-[0-9]+$' })), /does not match/],
      [registry.dynamicProducers.map(entry => ({ ...entry, expression: '`--syntax-${missing}`' })), /Stale dynamic producer/],
    ]) {
      await writeFile(registryPath, JSON.stringify({ ...registry, dynamicProducers }));
      await assert.rejects(buildTokenCatalog({ ...options, registryPath }), error);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
