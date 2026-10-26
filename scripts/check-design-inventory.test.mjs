import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkInventory, productionGraph } from './check-design-inventory.mjs';

const moduleDirectory = fileURLToPath(new URL('../apps/ui/node_modules', import.meta.url));
const appRequire = createRequire(new URL('../apps/ui/package.json', import.meta.url));
const row = path => `| \`${path}\` | Web | Controlled state | Existing colors | \`apps/ui/src/main.tsx\` | Internal; no independent Story |`;
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'memocard-design-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function put(path, text) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  await put('apps/ui/package.json', '{}');
  await put('apps/ui/tsconfig.json', JSON.stringify({ compilerOptions: { moduleResolution: 'bundler', module: 'esnext', jsx: 'react-jsx', verbatimModuleSyntax: true, paths: { '@/*': ['./src/*'] } }, include: ['src'] }));
  await symlink(moduleDirectory, join(root, 'apps/ui/node_modules'), 'dir');
  await put('apps/ui/src/main.tsx', [
    'import type { Config } from "./OnlyType";',
    'import { type Detail, Visible } from "./barrel";',
    'export type { Third } from "./ThirdType";',
    'const lazy = () => import("@/Lazy");',
    'type Another = import("./ImportType").Another;',
    '// import("./CommentOnly") is not a runtime dependency.',
    'export const app = Visible;',
  ].join('\n'));
  await put('apps/ui/src/barrel.ts', 'export { Visible } from "./Visible"; export type { Detail } from "./OnlyType";');
  await put('apps/ui/src/Visible.tsx', 'export function Visible() { return null; }');
  await put('apps/ui/src/Lazy.tsx', 'export default function Lazy() { return null; }');
  for (const name of ['OnlyType', 'ThirdType', 'ImportType', 'Historical']) {
    await put(`apps/ui/src/${name}.tsx`, 'export interface Config {}');
  }
  const paths = ['main', 'Visible', 'Lazy'].map(name => `apps/ui/src/${name}.tsx`);
  await put('design/component-inventory.md', paths.map(row).join('\n'));
  return { root, put, paths };
}

test('follows runtime barrels and alias lazy imports, excluding type-only syntax and unreferenced TSX', async t => {
  const { root } = await fixture(t);
  const graph = await productionGraph(root);
  assert.deepEqual([...graph.keys()].filter(path => path.endsWith('.tsx')).sort(),
    ['apps/ui/src/Lazy.tsx', 'apps/ui/src/Visible.tsx', 'apps/ui/src/main.tsx']);
  assert.deepEqual(await checkInventory({ root }), { productionModules: 3, entries: 3 });
});

test('keeps inline type module edges and their real runtime TSX descendants conservatively', async t => {
  const { root, put, paths } = await fixture(t);
  await put('apps/ui/src/Lazy.tsx', 'import { type T } from "./InlineImport"; export { type U } from "./InlineExport"; export default function Lazy() { return null; }');
  await put('apps/ui/src/InlineImport.ts', 'import "./ImportSideEffect"; export interface T {}');
  await put('apps/ui/src/InlineExport.ts', 'import "./ExportSideEffect"; export interface U {}');
  for (const name of ['ImportSideEffect', 'ExportSideEffect']) {
    await put(`apps/ui/src/${name}.tsx`, `console.log("${name} evaluated"); export const Component = () => null;`);
  }
  await assert.rejects(checkInventory({ root }), error =>
    error.message.includes('Unlisted production TSX: apps/ui/src/ImportSideEffect.tsx')
      && error.message.includes('Unlisted production TSX: apps/ui/src/ExportSideEffect.tsx'));
  await put('design/component-inventory.md', [...paths, 'apps/ui/src/ImportSideEffect.tsx', 'apps/ui/src/ExportSideEffect.tsx'].map(row).join('\n'));
  assert.deepEqual(await checkInventory({ root }), { productionModules: 5, entries: 5 });
});

test('installed Vite/Oxc preserves inline type imports but elides explicit type-only declarations', async t => {
  const { root } = await fixture(t);
  const { transformWithOxc } = await import(appRequire.resolve('vite'));
  const result = await transformWithOxc([
    'import { type T } from "./InlineImport";',
    'export { type U } from "./InlineExport";',
    'import type { Config } from "./OnlyType";',
    'export type { Third } from "./ThirdType";',
  ].join('\n'), join(root, 'apps/ui/src/emit.ts'), { tsconfig: join(root, 'apps/ui/tsconfig.json') });
  assert.match(result.code, /import\s+(?:\{\}\s+from\s+)?["']\.\/InlineImport["']/);
  assert.doesNotMatch(result.code, /OnlyType|ThirdType/);
  // Current Oxc elides this inline re-export; the source graph intentionally keeps its edge.
  assert.doesNotMatch(result.code, /InlineExport/);
});

test('fails when a newly runtime-imported production component has no maintenance row', async t => {
  const { root, put } = await fixture(t);
  await put('apps/ui/src/Forgotten.tsx', 'export const Forgotten = () => null;');
  await put('apps/ui/src/Lazy.tsx', 'import "./Forgotten"; export default function Lazy() { return null; }');
  await assert.rejects(checkInventory({ root }), /Unlisted production TSX: apps\/ui\/src\/Forgotten.tsx/);
});

test('fails for a stale implementation path and a broken verification entry', async t => {
  const { root, put, paths } = await fixture(t);
  await put('design/component-inventory.md', [...paths.map(row), row('apps/apple/Sources/Removed.swift'),
    '| `apps/apple/Sources/Native.swift` | iOS | Instance | System | `apps/ui/Removed.test.tsx` | No Preview |'].join('\n'));
  await put('apps/apple/Sources/Native.swift', 'struct Native {}');
  await assert.rejects(checkInventory({ root }), error =>
    error.message.includes('Missing inventory path: apps/apple/Sources/Removed.swift')
      && error.message.includes('Missing inventory path: apps/ui/Removed.test.tsx'));
});

test('rejects directory-only entries that are not production-reachable', async t => {
  const { root, put, paths } = await fixture(t);
  await put('design/component-inventory.md', [...paths, 'apps/ui/src/Historical.tsx'].map(row).join('\n'));
  await assert.rejects(checkInventory({ root }), /Inventory TSX is not production-reachable: apps\/ui\/src\/Historical.tsx/);
});

test('rejects duplicate module rows instead of counting them as additional coverage', async t => {
  const { root, put, paths } = await fixture(t);
  await put('design/component-inventory.md', [...paths, paths[0]].map(row).join('\n'));
  await assert.rejects(checkInventory({ root }), /Duplicate implementation: apps\/ui\/src\/main.tsx/);
});

test('requires the six maintenance fields and refuses silent nonliteral dynamic imports', async t => {
  const { root, put, paths } = await fixture(t);
  await put('design/component-inventory.md', [...paths.map(row), '| `apps/apple/Sources/Native.swift` |'].join('\n'));
  await put('apps/apple/Sources/Native.swift', 'struct Native {}');
  await assert.rejects(checkInventory({ root }), /Incomplete inventory row/);
  await put('design/component-inventory.md', paths.map(row).join('\n'));
  await put('apps/ui/src/Lazy.tsx', 'const target = "./Visible"; export const load = () => import(target);');
  await assert.rejects(checkInventory({ root }), /Nonliteral runtime import needs explicit inventory support/);
});

test('tracks the sole entry through current UI adapters and back into shared src cores', async t => {
  const { root, put, paths } = await fixture(t);
  await put('apps/ui/src/Lazy.tsx', 'export { CurrentView as default } from "../ui/CurrentView";');
  await put('apps/ui/ui/CurrentView.tsx', 'import { Visible } from "../src/Visible"; import type { Preview } from "./Preview"; export const CurrentView = Visible;');
  await put('apps/ui/ui/Preview.tsx', 'export interface Preview {}');
  await assert.rejects(checkInventory({ root }), /Unlisted production TSX: apps\/ui\/ui\/CurrentView.tsx/);
  await put('design/component-inventory.md', [...paths, 'apps/ui/ui/CurrentView.tsx'].map(row).join('\n'));
  assert.deepEqual(await checkInventory({ root }), { productionModules: 4, entries: 4 });
  await put('design/component-inventory.md', [...paths, 'apps/ui/ui/CurrentView.tsx', 'apps/ui/ui/Preview.tsx'].map(row).join('\n'));
  await assert.rejects(checkInventory({ root }), /Inventory TSX is not production-reachable: apps\/ui\/ui\/Preview.tsx/);
});
