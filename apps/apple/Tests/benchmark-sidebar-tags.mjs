// Developer benchmark only: CI tests semantics, never machine-dependent timing thresholds.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { cpus, release, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baselineRef = process.argv[2] ?? 'a53fb0a';
const directory = await mkdtemp(join(tmpdir(), 'memocard-sidebar-benchmark-'));
try {
  const { stdout: sidebar } = await run('git', ['show', `${baselineRef}:apps/apple/Sources/NativeSidebar.swift`], { cwd: root });
  const { stdout: chrome } = await run('git', ['show', `${baselineRef}:apps/apple/Sources/NativeChrome.swift`], { cwd: root });
  const model = chrome.match(/struct NativeAction: Decodable, Identifiable \{[\s\S]*?\n\}/)?.[0];
  const getter = sidebar.match(/    private var children: \[NativeAction\] \{[\s\S]*?\n    \}/)?.[0];
  const roots = sidebar.match(/tags\.filter \{ !\(\$0\.path \?\? ""\)\.contains\("\/"\) \}/)?.[0];
  if (!model || !getter || !roots) throw new Error('The baseline production source no longer matches the known pre-index seam.');
  const baselineSource = join(directory, 'Baseline.swift');
  await writeFile(baselineSource, `${model}\nstruct BaselineBranch { let item: NativeAction; let tags: [NativeAction]; let flat = false;\n${getter.replace('private var', 'var')}\n}\nfunc baselineRoots(_ tags: [NativeAction]) -> [NativeAction] { ${roots} }\n`);
  const indexSource = (await readFile(new URL('../Sources/NativeSidebar.swift', import.meta.url), 'utf8')).split('#if os(iOS)')[0];
  const { stdout: compiler } = await run('xcrun', ['swiftc', '--version']);
  console.log(JSON.stringify({ baselineRef, childrenGetterSHA256: createHash('sha256').update(getter).digest('hex'),
    indexSourceSHA256: createHash('sha256').update(indexSource).digest('hex'),
    environment: { architecture: process.arch, cpu: cpus()[0]?.model, osRelease: release(), compiler: compiler.trim() },
    fixture: '10 roots, 10-way breadth-first descendants, original array order, all expanded',
    comparison: 'same executable and fixture; baseline/indexed order alternates on each iteration',
    scope: 'optimized Swift CLI, one child lookup per row, includes index construction; excludes SwiftUI layout and bridge decoding' }));
  const executable = join(directory, 'SidebarTagBenchmark');
  await run('xcrun', ['swiftc', '-O', '-swift-version', '5', baselineSource,
    fileURLToPath(new URL('../Sources/NativeSidebar.swift', import.meta.url)),
    fileURLToPath(new URL('./SidebarTagBenchmark.swift', import.meta.url)), '-o', executable]);
  await new Promise((resolve, reject) => {
    const child = spawn(executable, [], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Benchmark exited with ${code}`)));
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
