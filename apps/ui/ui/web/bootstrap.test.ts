// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { execFile } from "node:child_process";
import { execPath } from "node:process";
import { promisify } from "node:util";
import webConfig from "../../vite.config.ts";
import { expect, it } from "vitest";

it("resolves the real browser bootstrap after vendor chunking without an async dependency deadlock", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "memocard-bootstrap-"));
  const uiRoot = fileURLToPath(new URL("../../", import.meta.url));
  const runtime = path.join(uiRoot, "src/browser-runtime.ts");
  const uuid = path.join(uiRoot, "src/uuid.ts");
  const tags = path.join(uiRoot, "src/inline-tags.ts");
  const react = path.join(uiRoot, "node_modules/react/index.js");
  try {
    await writeFile(path.join(directory, "index.html"), '<script type="module" src="/main.js"></script>');
    await writeFile(path.join(directory, "main.js"), `import { getBrowserVaultBinding } from ${JSON.stringify(runtime)}; import { createId } from ${JSON.stringify(uuid)}; import { inlineTags } from ${JSON.stringify(tags)}; import React from ${JSON.stringify(react)}; globalThis.__bootstrapReady = typeof getBrowserVaultBinding === 'function' && typeof createId === 'function' && inlineTags('#ready')[0] === 'ready' && typeof React.createElement === 'function';`);
    // Native module imports execute from file: URLs in the child process. JSDOM
    // cannot preload those URLs; this probe exercises chunk evaluation instead.
    const result = await build({ configFile: false, root: directory, logLevel: "silent", resolve: webConfig.resolve, build: { target: "safari16.4", modulePreload: { polyfill: false }, outDir: path.join(directory, "dist"), rolldownOptions: webConfig.build?.rolldownOptions } });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(value => "output" in value ? value.output : []);
    const entry = outputs.find(value => value.type === "chunk" && value.isEntry)!;
    const entryPath = path.join(directory, "dist", entry.fileName);
    const probe = `import { JSDOM } from 'jsdom'; import { pathToFileURL } from 'node:url'; const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {url:'http://localhost/'}); globalThis.window = dom.window; globalThis.document = dom.window.document; Object.defineProperty(globalThis, 'navigator', {configurable:true,value:dom.window.navigator}); const timer = setTimeout(() => { console.error('BOOTSTRAP_TIMEOUT'); process.exit(2); }, 3000); await import(pathToFileURL(${JSON.stringify(entryPath)}).href); if (!globalThis.__bootstrapReady) throw new Error('Bootstrap did not evaluate'); clearTimeout(timer); dom.window.close(); console.log('BOOTSTRAP_RESOLVED');`;
    const { stdout } = await promisify(execFile)(execPath, ["--input-type=module", "-e", probe], { cwd: uiRoot, timeout: 10_000 });
    expect(stdout).toContain("BOOTSTRAP_RESOLVED");
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 20_000);
