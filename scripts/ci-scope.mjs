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

const platforms = ['mac', 'ios', 'service'];
const full = { design: 'ui', web: true, native: true, surfaces: true, platforms };

export function classifyDiff(raw) {
  if (!raw || !raw.endsWith('\0')) return full;
  const fields = raw.slice(0, -1).split('\0');
  if (fields.length % 2) return full;
  const plan = { design: 'none', web: false, native: false, surfaces: false, platforms: [] };
  const builds = new Set();
  for (let index = 0; index < fields.length; index += 2) {
    const entry = /^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([AMD])$/.exec(fields[index]);
    const path = fields[index + 1];
    if (!entry || !entry.slice(1, 3).every(mode => ['000000', '100644', '100755'].includes(mode))
        || path.split('/').some(part => !part || part === '.' || part === '..')) return full;
    if (isDocumentation(path)) {
      if (path.startsWith('apps/ui/')) plan.design = 'ui';
      else if (plan.design === 'none') plan.design = 'docs';
    } else if (/^apps\/ui\/src\/(?!generated\/).+\.(tsx?|css)$/s.test(path)) {
      plan.design = 'ui';
      plan.web = true;
      if (!/\.test\.tsx?$/.test(path)) platforms.forEach(platform => builds.add(platform));
    } else if (/^packages\/native-core\/Sources\/.+\.swift$/.test(path)) {
      plan.native = true;
      plan.surfaces = true;
      platforms.forEach(platform => builds.add(platform));
    } else if (/^(apps\/apple\/(Service|Tunnel)\/|packages\/local-service\/Sources\/)/.test(path)) {
      plan.native = true;
      builds.add('service');
    } else if (/^packages\/(native-core|local-service)\/Tests\/.+\.swift$/.test(path)
        || /^apps\/apple\/Tests\/(ServiceHostHarness\.swift|ServiceMCPServerHarness\.swift|LocalWebServerHarness\.swift|(service-host|service-mcp-server|local-web-server|tunnel-companion)\.test\.mjs)$/.test(path)) {
      plan.native = true;
    } else {
      return full;
    }
  }
  plan.platforms = platforms.filter(platform => builds.has(platform));
  return plan;
}

export function scopeForEvent(eventName, event, cwd = process.cwd(), verifiedMain = '') {
  try {
    const push = eventName === 'push';
    if (!push && eventName !== 'pull_request') return full;
    const base = push ? event.before : event.pull_request?.base?.sha;
    const head = push ? event.after : event.pull_request?.head?.sha;
    if (![base, head].every(sha => /^[0-9a-f]{40}$/.test(sha ?? '') && !/^0+$/.test(sha))) return full;
    const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    if (push) {
      // A cancelled or failed predecessor cannot supply verification for unchanged files.
      if (event.ref !== 'refs/heads/main' || base !== verifiedMain || git(['rev-parse', 'HEAD']).trim() !== head) return full;
      git(['merge-base', '--is-ancestor', base, head]);
    } else {
      git(['merge-base', '--is-ancestor', head, 'HEAD']);
    }
    return classifyDiff(git(['diff', '--raw', '--no-abbrev', '--no-renames', '-z', push ? `${base}..${head}` : `${base}...${head}`, '--']));
  } catch {
    return full;
  }
}

export function gatePasses(needs) {
  if (needs.changes?.result !== 'success') return false;
  let plan;
  try { plan = JSON.parse(needs.changes.outputs.plan); } catch { return false; }
  if (!plan || !['none', 'docs', 'ui'].includes(plan.design) || !['web', 'native', 'surfaces'].every(key => typeof plan[key] === 'boolean')
      || !Array.isArray(plan.platforms) || !plan.platforms.every(platform => platforms.includes(platform))) return false;
  const build = plan.platforms.length > 0;
  const required = { design: plan.design !== 'none', 'release-web': plan.web || build, 'release-native': plan.native,
    'native-surfaces': plan.surfaces, 'native-build': build };
  return Object.values(required).some(Boolean) && Object.entries(required).every(([job, run]) =>
    needs[job]?.result === (run ? 'success' : 'skipped'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--gate')) {
    const needs = JSON.parse(process.env.CI_NEEDS);
    console.log(JSON.stringify(needs, null, 2));
    if (!gatePasses(needs)) process.exitCode = 1;
  } else {
    let scope;
    try {
      scope = scopeForEvent(process.env.GITHUB_EVENT_NAME, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), process.cwd(), process.env.VERIFIED_MAIN);
    } catch {
      scope = full;
    }
    const plan = JSON.stringify(scope);
    console.log(plan);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `plan=${plan}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Verification scope\n\n\`\`\`json\n${plan}\n\`\`\`\n`);
  }
}
