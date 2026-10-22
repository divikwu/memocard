import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectIconReferences, buildProjectIconCatalog } from './build-project-icon-catalog.mjs';
import { productionGraph } from './check-design-inventory.mjs';

test('collects runtime values, deduplicates aliases, and excludes unused, type-only and shadowed imports', () => {
  const references = collectIconReferences(new Map([['fixture.tsx', `
    import { XIcon as Close, X, MoreHorizontal, Ellipsis, House, Search, CalendarDays, type LucideIcon } from 'lucide-react';
    type OnlyType = typeof Search;
    const text = 'House'; // House is not a runtime reference.
    const mapping = { MoreHorizontal };
    function nested(House: unknown) { return House; }
    const view = <><Close /><X /><Ellipsis /></>;
  `]]));
  assert.deepEqual([...references.keys()].sort(), ['Ellipsis', 'X']);
  assert.deepEqual([...references.get('X')], ['fixture.tsx']);
});

test('rejects unsupported icon import patterns instead of silently returning an incomplete list', () => {
  assert.throws(() => collectIconReferences(new Map([['fixture.tsx', `import * as Icons from 'lucide-react'; const icon = Icons.X;`]])), /named Lucide imports/);
  assert.throws(() => collectIconReferences(new Map([['fixture.tsx', `export { X } from 'lucide-react';`]])), /re-export usage/);
  assert.throws(() => collectIconReferences(new Map([['fixture.tsx', `const icons = await import('lucide-react');`]])), /named Lucide imports/);
});

test('production catalog excludes test/story/unreachable sources, preserves mtimes and detects drift', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-icon-catalog-'));
  try {
    const outputPath = join(directory, 'icons.json');
    const result = await buildProjectIconCatalog({ outputPath });
    const content = await readFile(outputPath, 'utf8'), catalog = JSON.parse(content);
    const graph = await productionGraph();
    assert.equal(catalog.icons.length, result.icons);
    assert.ok(result.icons > 10);
    assert.equal(new Set(catalog.icons.map(icon => icon.name)).size, result.icons);
    assert.ok(catalog.icons.every(icon => icon.svg.startsWith('<svg') && icon.consumers.length));
    assert.ok(catalog.icons.every(icon => icon.consumers.every(path => !/stories|\.(?:test|spec)\./.test(path))));
    assert.ok(catalog.icons.every(icon => icon.consumers.every(path => path === 'apps/apple/Sources/NativeSidebar.swift' || graph.has(path))));
    assert.ok(catalog.icons.find(icon => icon.name === 'PanelLeft').consumers.includes('apps/ui/src/components/ui/sidebar.tsx'));
    assert.ok(catalog.icons.find(icon => icon.name === 'House').consumers.includes('apps/apple/Sources/NativeSidebar.swift'));
    assert.ok(!catalog.icons.some(icon => ['XIcon', 'LucideX', 'MoreHorizontal'].includes(icon.name)));
    await utimes(outputPath, new Date('2001-01-01'), new Date('2001-01-01'));
    const mtime = (await stat(outputPath)).mtimeMs;
    await buildProjectIconCatalog({ outputPath });
    await buildProjectIconCatalog({ outputPath, check: true });
    assert.equal((await stat(outputPath)).mtimeMs, mtime);
    await writeFile(outputPath, 'manual catalog');
    await assert.rejects(buildProjectIconCatalog({ outputPath, check: true }), /catalog is stale/);
    assert.equal(await readFile(outputPath, 'utf8'), 'manual catalog');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
