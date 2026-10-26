import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const documentation = new Set(['README.md', 'design/README.md', 'design/component-inventory.md', 'design/token-consumption.md']);

export function isDocumentation(path) {
  if (path.split('/').some(part => !part || part === '.' || part === '..')) return false;
  return documentation.has(path)
    || /^docs\/.+\.(md|png|jpe?g|webp)$/s.test(path)
    || /^apps\/ui\/(ui\/stories|\.storybook)\/.+\.(tsx?|css|html|mdx?)$/s.test(path);
}

export function classifyDiff(raw) {
  const full = reason => ({ full: true, reason });
  if (!raw || !raw.endsWith('\0')) return full('Empty or incomplete diff');
  const fields = raw.slice(0, -1).split('\0');
  if (fields.length % 2) return full('Malformed diff');
  for (let index = 0; index < fields.length; index += 2) {
    const entry = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([AMD])$/.exec(fields[index]);
    if (!entry || !entry.slice(1, 3).every(mode => ['000000', '100644', '100755'].includes(mode))) return full('Unsupported status or file type');
    if (!isDocumentation(fields[index + 1])) return full('Production, token, dependency, build or unknown path changed');
  }
  return { full: false, reason: `Only Storybook/documentation paths changed (${fields.length / 2})` };
}

export function scopeForEvent(eventName, event, cwd = process.cwd()) {
  try {
    // A docs push can supersede an unfinished production run in the main concurrency group.
    // Every push must verify its whole tree; only cumulative PR diffs may use the fast path.
    if (eventName === 'push') return { full: true, reason: 'Main pushes always require full verification, including superseded production changes' };
    if (eventName !== 'pull_request') throw new Error('Unsupported event');
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    if (![base, head].every(sha => /^[0-9a-f]{40}$/.test(sha ?? '') && !/^0+$/.test(sha))) throw new Error('Missing event revisions');
    const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    git(['merge-base', '--is-ancestor', head, 'HEAD']);
    // PR scope is cumulative, even when the latest commit changes only docs.
    return classifyDiff(git(['diff', '--raw', '--no-abbrev', '--no-renames', '-z', `${base}...${head}`, '--']));
  } catch {
    return { full: true, reason: 'Unavailable, oversized or invalid diff; full verification required' };
  }
}

export function gatePasses(needs) {
  const full = needs.changes?.outputs?.full;
  return needs.changes?.result === 'success' && needs.design?.result === 'success'
    && ['release-web', 'release-native', 'native-surfaces', 'native-build'].every(job =>
      full === 'true' ? needs[job]?.result === 'success'
        : full === 'false' && needs[job]?.result === 'skipped');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--gate')) {
    const needs = JSON.parse(process.env.CI_NEEDS);
    console.log(JSON.stringify(needs, null, 2));
    if (!gatePasses(needs)) process.exitCode = 1;
  } else {
    let scope;
    try {
      scope = scopeForEvent(process.env.GITHUB_EVENT_NAME, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
    } catch {
      scope = { full: true, reason: 'Unreadable event; full verification required' };
    }
    console.log(JSON.stringify(scope));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `full=${scope.full}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Verification scope\n${scope.full ? 'Full release' : 'Storybook/documentation fast path'}: ${scope.reason}\n`);
  }
}
