import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planMigration, applyMigration } from './migrate-uuid-notes.mjs';
const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
async function fixture(task) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'memocard-migrate-'));
  const root = path.join(temp, 'vault');
  await fs.mkdir(path.join(root, '.memocard'), { recursive: true }); await fs.mkdir(path.join(root, 'notes'));
  await fs.writeFile(path.join(root, '.memocard/vault.json'), JSON.stringify({ formatVersion: 1, vaultId: first }));
  const source = id => `---\nid: "${id}"\ntitle: "Same"\ncustom: preserve\n---\n# Heading\n[[${first}#Heading|alias]]`;
  await fs.writeFile(path.join(root, `notes/${first}.md`), source(first));
  await fs.writeFile(path.join(root, `notes/${second}.md`), source(second));
  try { await task({ root, temp, source }); } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
test('dry run is read-only; migration retains ids, headers, headings and updates links with collision suffix', () => fixture(async ({ root, temp, source }) => {
  const plan = await planMigration(root);
  assert.equal(plan.renames[`notes/${first}.md`], 'notes/Same.md');
  assert.equal(plan.renames[`notes/${second}.md`], 'notes/Same (2).md');
  assert.equal(await fs.readFile(path.join(root, `notes/${first}.md`), 'utf8'), source(first));
  const manifest = await applyMigration(plan, path.join(temp, 'backup'));
  assert.equal(JSON.parse(await fs.readFile(manifest, 'utf8')).status, 'complete');
  for (const [id, name] of [[first, 'Same'], [second, 'Same (2)']]) {
    assert.equal(await fs.readFile(path.join(root, `notes/${name}.md`), 'utf8'), source(id).replace(`[[${first}`, '[[notes/Same'));
    assert.equal(await fs.readFile(path.join(temp, `backup/vault/notes/${id}.md`), 'utf8'), source(id));
  }
  assert.equal((await planMigration(root)).changes.length, 0);
}));
test('changed source refuses migration before deleting or overwriting any original', () => fixture(async ({ root, temp }) => {
  const plan = await planMigration(root);
  await fs.appendFile(path.join(root, `notes/${first}.md`), '\nexternal');
  await assert.rejects(applyMigration(plan, path.join(temp, 'backup')), /changed/);
  assert.equal((await fs.readdir(path.join(root, 'notes'))).length, 2);
}));
test('a destination created after planning is preserved', () => fixture(async ({ root, temp }) => {
  const plan = await planMigration(root);
  await fs.writeFile(path.join(root, 'notes/Same (2).md'), 'external');
  await assert.rejects(applyMigration(plan, path.join(temp, 'backup')), /Markdown files changed.*Same \(2\)[.]md/);
  assert.equal(await fs.readFile(path.join(root, 'notes/Same (2).md'), 'utf8'), 'external');
  assert.ok(await fs.stat(path.join(root, `notes/${first}.md`)));
  assert.ok(await fs.stat(path.join(root, `notes/${second}.md`)));
  await assert.rejects(fs.stat(path.join(root, 'notes/Same.md')));
}));

test('rejects a newly added Markdown file and rewrites its link after replanning', () => fixture(async ({ root, temp, source }) => {
  const plan = await planMigration(root);
  const late = 'notes/nested/Added.MD';
  const contents = source('33333333-3333-4333-8333-333333333333');
  await fs.mkdir(path.join(root, 'notes/nested'));
  await fs.writeFile(path.join(root, late), contents);

  await assert.rejects(applyMigration(plan, path.join(temp, 'backup')), /Markdown files changed.*notes\/nested\/Added[.]MD/);
  for (const id of [first, second]) assert.equal(await fs.readFile(path.join(root, `notes/${id}.md`), 'utf8'), source(id));
  assert.equal(await fs.readFile(path.join(root, late), 'utf8'), contents);
  await assert.rejects(fs.stat(path.join(root, 'notes/Same.md')), { code: 'ENOENT' });

  const updatedPlan = await planMigration(root);
  await applyMigration(updatedPlan, path.join(temp, 'updated-backup'));
  assert.equal(await fs.readFile(path.join(root, late), 'utf8'), contents.replace(`[[${first}`, '[[notes/Same'));
}));

test('keeps original paths and rolls back migration writes if a note arrives during apply', t => fixture(async ({ root, temp, source }) => {
  const plan = await planMigration(root);
  const late = path.join(root, 'notes/Added.md');
  const contents = source('33333333-3333-4333-8333-333333333333');
  const writeFile = fs.writeFile;
  t.mock.method(fs, 'writeFile', async (file, ...args) => {
    await writeFile(file, ...args);
    if (file === path.join(plan.root, 'notes/Same (2).md')) await writeFile(late, contents);
  });

  await assert.rejects(applyMigration(plan, path.join(temp, 'backup')), /Markdown files changed.*notes\/Added[.]md/);
  for (const id of [first, second]) assert.equal(await fs.readFile(path.join(root, `notes/${id}.md`), 'utf8'), source(id));
  assert.equal(await fs.readFile(late, 'utf8'), contents);
  for (const name of ['Same.md', 'Same (2).md']) {
    await assert.rejects(fs.stat(path.join(root, 'notes', name)), { code: 'ENOENT' });
  }
  const manifest = JSON.parse(await fs.readFile(path.join(temp, 'backup/manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'recovery-required');
}));

test('rolls back if an otherwise unchanged note gains a legacy link during apply', t => fixture(async ({ root, temp, source }) => {
  const preserved = path.join(root, 'notes/preserved.md');
  const unchanged = source('33333333-3333-4333-8333-333333333333').split('\n[[')[0];
  await fs.writeFile(preserved, unchanged);
  const plan = await planMigration(root);
  const unlink = fs.unlink;
  t.mock.method(fs, 'unlink', async file => {
    await unlink(file);
    if (file === path.join(plan.root, `notes/${first}.md`)) await fs.appendFile(preserved, `\n[[${first}]]`);
  });
  await assert.rejects(applyMigration(plan, path.join(temp, 'backup')), /Source changed: notes\/preserved[.]md/);
  assert.equal(await fs.readFile(preserved, 'utf8'), `${unchanged}\n[[${first}]]`);
  for (const id of [first, second]) assert.equal(await fs.readFile(path.join(root, `notes/${id}.md`), 'utf8'), source(id));
}));
