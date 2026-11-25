import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classifyDiff } from './ci-scope.mjs';

// The local entry point and the CI jobs run the same design and Web commands.
export function designChecks(plan) {
  if (plan.design === 'docs') return ['check:design-inventory', 'test:design-inventory'];
  if (plan.design !== 'ui') return [];
  const checks = ['verify:design', 'verify:ui:preview'];
  if (!plan.web && !plan.unit) checks.push('--filter @memocard/ui test:ui');
  return checks;
}

export function webChecks(plan) {
  if (plan.web) return ['verify:web'];
  const checks = [];
  if (plan.unit) checks.push('--filter @memocard/ui typecheck', '--filter @memocard/ui lint', '--filter @memocard/ui test');
  if (plan.smoke || plan.platforms.length) checks.push('--filter @memocard/ui build', 'check:bundle');
  if (plan.smoke) checks.push('test:default-ui');
  return checks;
}

export function localChecks(plan) {
  const checks = [...designChecks(plan), ...webChecks(plan)];
  if (plan.native) checks.push('verify:native:all');
  if (plan.surfaces) checks.push('check:apple-project', 'test:native-surfaces');
  return [...checks, ...plan.platforms.map(platform => 'build:' + platform)];
}

function run(args) {
  let checks;
  if (args.length === 1 && ['design', 'web'].includes(args[0])) {
    const plan = JSON.parse(process.env.CI_PLAN);
    checks = args[0] === 'design' ? designChecks(plan) : webChecks(plan);
  } else {
    if (args.length && !(args.length === 1 && args[0] === '--plan')) throw new Error('Usage: pnpm verify:changed [--plan]');
    const diff = execFileSync('git', ['diff', '--cached', '--raw', '--no-abbrev', '--no-renames', '-z', '--'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (!diff) {
      console.log('没有暂存改动。');
      return;
    }
    checks = localChecks(classifyDiff(diff));
    console.log('已按暂存路径选择以下检查，执行时读取当前工作树：');
  }
  console.log(checks.map(check => 'pnpm ' + check).join('\n'));
  if (args[0] === '--plan') return;
  for (const check of checks) {
    // All selected native builds follow a successful Web build in this invocation.
    const env = check.startsWith('build:') ? { ...process.env, MEMOCARD_USE_PREBUILT_UI: '1' } : process.env;
    execFileSync('pnpm', check.split(' '), { stdio: 'inherit', env });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { run(process.argv.slice(2)); }
  catch (error) {
    console.error(error.message);
    process.exitCode = error.status || 1;
  }
}
