import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildThemeContract({ catalogPath = resolve(root, 'design/token-coverage.generated.json'), outputPath = resolve(root, 'apps/ui/src/generated/theme-contract.ts'), check = false } = {}) {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const registry = JSON.parse(await readFile(resolve(root, 'design/tokens/registry.json'), 'utf8'));
  const upstream = (await Promise.all([...registry.upstreamSources, ...registry.generatedSources].map(path => readFile(resolve(root, path), 'utf8')))).join('\n');
  const names = ['--radius', ...catalog.css.filter(token => (token.layer !== 'adapter' || token.id === 'typography.line-scale') && token.declarations.some(declaration => !declaration.scope.startsWith('@theme inline'))).map(token => token.name)];
  const known = [...new Set([...catalog.css, ...catalog.runtime, ...catalog.external].map(token => token.name).concat([...upstream.matchAll(/(--[\w-]+):/g)].map(match => match[1])))].sort();
  const definitions = Object.fromEntries(catalog.css.map(token => [token.name, token.declarations.map(({ scope, value }) => ({ scope, value }))]));
  const content = `// Generated from the token catalog; run pnpm tokens:build.\nexport const themeTokenNames = ${JSON.stringify(names, null, 2)} as const;\nexport type ThemeTokenName = typeof themeTokenNames[number];\nexport const knownTokenNames: readonly string[] = ${JSON.stringify(known, null, 2)};\nexport const themeTokenDefinitions: Record<string, readonly { scope: string; value: string }[]> = ${JSON.stringify(definitions, null, 2)};\n`;
  const current = await readFile(outputPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return ''; });
  if (current !== content) {
    if (check) throw new Error('Theme token contract is stale. Run pnpm tokens:build.');
    await writeFile(outputPath, content);
  }
  return { tokens: names.length, references: known.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log('Theme contract:', await buildThemeContract({ check: process.argv.includes('--check') }));
