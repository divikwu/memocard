import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(repo, 'apps/ui/package.json'));
const ts = require('typescript'), yaml = require('yaml');
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64');
const resolver = moduleUrl(await fs.readFile(path.join(repo, 'apps/ui/src/link-candidates.ts'), 'utf8'));
const naming = await import(moduleUrl((await fs.readFile(path.join(repo, 'apps/ui/src/note-files.ts'), 'utf8')).replace("'./link-candidates'", JSON.stringify(resolver))));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function planMigration(root) {
  root = await fs.realpath(root);
  // This maintenance command is intentionally restricted to legacy MemoCard vaults.
  if (path.basename(root) === 'diw_os') throw new Error('diw_os is read-only and excluded from migration.');
  const metadata = JSON.parse(await fs.readFile(path.join(root, '.memocard/vault.json'), 'utf8'));
  if (metadata.formatVersion !== 1) throw new Error('Only legacy MemoCard formatVersion 1 is supported.');
  const files = new Map();
  async function walk(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) throw new Error('Symlinks are not supported.');
      const full = path.join(directory, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.name.endsWith('.md')) files.set(path.relative(root, full), await fs.readFile(full));
    }
  }
  await walk(path.join(root, 'notes'));
  const paths = [...files.keys()].sort(), occupied = [...paths], renames = {};
  const ids = new Set();
  for (const old of paths) {
    const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(files.get(old));
    const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (!header) throw new Error(`Missing frontmatter: ${old}`);
    const doc = yaml.parseDocument(header[1], { schema: 'yaml-1.1', uniqueKeys: true });
    if (doc.errors.length || typeof doc.get('id') !== 'string' || ids.has(doc.get('id'))) throw new Error(`Invalid or duplicate identity: ${old}`);
    ids.add(doc.get('id'));
    if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\.md$/i.test(path.basename(old))) continue;
    const body = source.slice(header[0].length);
    const title = typeof doc.get('title') === 'string' && doc.get('title').trim() ? doc.get('title') : (body.split(/\r?\n/).find(line => line.trim()) ?? '未命名').replace(/^[#\s]+/, '');
    const next = naming.namedNotePath(old, title, occupied);
    renames[old] = next; occupied.push(next);
  }
  const changes = paths.map(old => {
    const before = files.get(old), after = Buffer.from(naming.rewriteNoteLinks(before.toString('utf8'), old, paths, renames));
    return { old, next: renames[old] ?? old, before, after };
  }).filter(item => item.old !== item.next || !item.before.equals(item.after));
  return { root, vaultId: metadata.vaultId, files, changes, renames };
}

export async function applyMigration(plan, destination) {
  const backup = path.resolve(destination);
  if (backup.startsWith(plan.root + path.sep)) throw new Error('Backup must be outside the vault.');
  await fs.mkdir(backup, { recursive: false });
  await fs.cp(plan.root, path.join(backup, 'vault'), { recursive: true, errorOnExist: true, force: false });
  const manifest = { root: plan.root, vaultId: plan.vaultId, status: 'prepared', createdAt: new Date().toISOString(), changes: plan.changes.map(item => ({ old: item.old, next: item.next, beforeHash: hash(item.before), afterHash: hash(item.after) })) };
  const manifestPath = path.join(backup, 'manifest.json');
  const record = () => fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await record();
  for (const [name, bytes] of plan.files) {
    if (!bytes.equals(await fs.readFile(path.join(plan.root, name))) || !bytes.equals(await fs.readFile(path.join(backup, 'vault', name)))) throw new Error(`Source or backup changed: ${name}`);
  }
  const written = [];
  try {
    // Create every destination first; remove old files only after all content is verified.
    for (const change of plan.changes) {
      if (!change.before.equals(await fs.readFile(path.join(plan.root, change.old)))) throw new Error(`Source changed: ${change.old}`);
      if (change.old !== change.next) await fs.writeFile(path.join(plan.root, change.next), change.after, { flag: 'wx' });
      else {
        const temporary = path.join(plan.root, change.old + '.migration-tmp');
        await fs.writeFile(temporary, change.after, { flag: 'wx' });
        await fs.rename(temporary, path.join(plan.root, change.old));
      }
      written.push(change);
    }
    for (const change of plan.changes) {
      if (!change.after.equals(await fs.readFile(path.join(plan.root, change.next)))) throw new Error(`Verification failed: ${change.next}`);
      if (change.old !== change.next) {
        if (!change.before.equals(await fs.readFile(path.join(plan.root, change.old)))) throw new Error(`Source changed: ${change.old}`);
        await fs.unlink(path.join(plan.root, change.old));
      }
    }
    manifest.status = 'complete'; await record();
  } catch (error) {
    manifest.status = 'recovery-required'; await record();
    // Only roll back our exact committed bytes. Preserve any concurrent external edit.
    for (const change of written.reverse()) {
      const current = await fs.readFile(path.join(plan.root, change.next)).catch(() => undefined);
      if (current?.equals(change.after)) {
        if (change.old === change.next) await fs.writeFile(path.join(plan.root, change.old), change.before);
        else {
          await fs.writeFile(path.join(plan.root, change.old), change.before, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; });
          await fs.unlink(path.join(plan.root, change.next));
        }
      }
    }
    throw error;
  }
  return manifestPath;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , root, ...options] = process.argv;
  if (!root) throw new Error('Usage: node scripts/migrate-uuid-notes.mjs VAULT [--apply BACKUP_DIRECTORY]');
  const plan = await planMigration(root);
  console.log(JSON.stringify({ vaultId: plan.vaultId, notes: plan.files.size, renames: plan.renames }, null, 2));
  if (options[0] === '--apply' && options[1]) console.log(await applyMigration(plan, options[1]));
  else if (options.length) throw new Error('Invalid options.');
}
