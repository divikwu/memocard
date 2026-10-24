import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTheme } from '../apps/ui/src/features/theme/define-theme.ts';

export async function readTheme(path, lineage = new Set()) {
  path = resolve(path);
  if (lineage.has(path)) throw new Error(`Cyclic theme file inheritance: ${path}`);
  const input = JSON.parse(await readFile(path, 'utf8'));
  if (Object.hasOwn(input, 'extends')) {
    if (typeof input.extends !== 'string' || !input.extends.startsWith('.')) throw new Error('Theme file extends must be a relative JSON path.');
    const next = new Set(lineage); next.add(path);
    input.extends = await readTheme(resolve(dirname(path), input.extends), next);
  }
  return defineTheme(input);
}
export async function buildTheme({ inputPath, outputPath, check = false }) {
  const theme = await readTheme(inputPath);
  const content = `/* Generated theme: ${theme.name}. Edit its JSON source. */\n${theme.cssText}`;
  const current = await readFile(outputPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return ''; });
  if (current !== content) {
    if (check) throw new Error(`Built theme is stale: ${outputPath}`);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content);
  }
  return theme;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), check = args.includes('--check'), paths = args.filter(arg => arg !== '--check');
  if (paths.length !== 2 || paths.some(arg => arg.startsWith('--'))) throw new Error('Usage: node scripts/build-theme.mjs input.json output.css [--check]');
  console.log('Theme built:', (await buildTheme({ inputPath: paths[0], outputPath: paths[1], check })).name);
}
