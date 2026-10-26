import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectSpacingUsage, buildProjectSpacingCatalog } from './build-project-spacing-catalog.mjs';
import { productionGraph } from './check-design-inventory.mjs';

const require = createRequire(new URL('../apps/ui/package.json', import.meta.url));
const theme = await readFile(require.resolve('tailwindcss/theme.css'), 'utf8');

test('collects valid spacing utilities, variants, templates and @apply; excludes comments, types, imports and unrelated sizes', async () => {
  const catalog = await collectSpacingUsage(new Map([
    ['fixture.tsx', `import 'p-96'; type Example = 'p-80'; // p-72
      const view = <div className={\`p-0 gap-px gap-x-0.5 md:-mx-2 px-2! space-y-3 scroll-mt-4 w-40 h-48 translate-x-12 p-garbage bad:p-64 \${active ? 'p-6' : 'p-8'}\`}/>;
      const local = 'ml-auto p-[3px] pb-[env(safe-area-inset-bottom)]';
      const incomplete = \`p-40\${size} \${prefix}gap-48\`;`],
    ['fixture.css', '/* @apply p-96; */ .layout { @apply py-1.5; width: 80px; }'],
  ]), theme);
  assert.deepEqual(catalog.scale.map(row => row.step), ['px', '0', '0.5', '1.5', '2', '3', '4', '6', '8']);
  assert.equal(catalog.scale.find(row => row.step === '0.5').value, 'calc(var(--spacing) * 0.5)');
  assert.ok(catalog.usage.find(row => row.utility === 'md:-mx-2').step === '2', 'Negative margins share their positive scale magnitude');
  assert.ok(catalog.usage.find(row => row.utility === 'ml-auto').step === null);
  assert.ok(catalog.usage.find(row => row.utility === 'p-[3px]').step === null);
  assert.ok(catalog.usage.find(row => row.utility === 'pb-[env(safe-area-inset-bottom)]').step === null);
  assert.ok(!catalog.usage.some(row => /garbage|bad:|w-40|h-48|translate|p-96|p-80|p-72|p-40|gap-48/.test(row.utility)));
});

test('reads the upstream base and generated expressions instead of a copied fixed scale', async () => {
  const catalog = await collectSpacingUsage(new Map([['fixture.tsx', 'const classes = "gap-1 gap-7.5 p-20";']]), theme);
  assert.deepEqual(catalog.scale, [{ step: '1', value: 'var(--spacing)' }, { step: '7.5', value: 'calc(var(--spacing) * 7.5)' }, { step: '20', value: 'calc(var(--spacing) * 20)' }]);
});

test('production catalog is reachable, deterministic and read-only on drift', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-spacing-catalog-'));
  try {
    const outputPath = join(directory, 'spacing.json');
    const result = await buildProjectSpacingCatalog({ outputPath });
    const content = await readFile(outputPath, 'utf8'), catalog = JSON.parse(content), graph = await productionGraph();
    assert.ok(result.steps > 6 && result.utilities > result.steps);
    assert.equal(catalog.upstream.value, theme.match(/--spacing:\s*([^;]+);/)[1]);
    assert.equal(catalog.upstream.version, require('tailwindcss/package.json').version);
    assert.ok(catalog.usage.every(row => row.consumers.every(path => path.endsWith('.css') || graph.has(path))));
    assert.ok(catalog.usage.every(row => row.consumers.every(path => !/stories|\.(?:test|spec)\./.test(path))));
    assert.ok(catalog.usage.find(row => row.utility === 'p-1').consumers.includes('apps/ui/ui/components/tabs.tsx'));
    assert.deepEqual(catalog.scale.map(row => row.step).sort(), [...new Set(catalog.usage.map(row => row.step).filter(step => step !== null))].sort());
    await utimes(outputPath, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtime = (await stat(outputPath)).mtimeMs;
    await buildProjectSpacingCatalog({ outputPath });
    await buildProjectSpacingCatalog({ outputPath, check: true });
    assert.equal((await stat(outputPath)).mtimeMs, mtime);
    await writeFile(outputPath, 'manual catalog');
    await assert.rejects(buildProjectSpacingCatalog({ outputPath, check: true }), /catalog is stale/);
    assert.equal(await readFile(outputPath, 'utf8'), 'manual catalog');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
