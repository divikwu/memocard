import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const uiRoot = fileURLToPath(new URL('../apps/ui/', import.meta.url));
const output = fileURLToPath(new URL('../build/verification/performance/note-authoring/', import.meta.url));
const require = createRequire(`${uiRoot}package.json`);
const { chromium } = require('playwright');
const { preview } = await import(require.resolve('vite'));
const server = await preview({ configFile: false, root: uiRoot, base: './', logLevel: 'error', build: { outDir: `${uiRoot}dist` }, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const results = [];
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samplesMs: values.map(value => Math.round(value)), medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]), maxMs: Math.round(sorted.at(-1)) };
};
try {
  for (const fixture of [
    { name: 'ordinary', tags: 100, properties: 10, bodyChars: 2_000 },
    { name: 'many-tags', tags: 2_000, properties: 10, bodyChars: 2_000 },
    { name: 'many-tags-collapsed', tags: 2_000, properties: 10, bodyChars: 2_000, collapseSidebarTags: true },
    { name: 'many-properties', tags: 100, properties: 100, bodyChars: 2_000 },
    { name: 'long-note', tags: 100, properties: 10, bodyChars: 100_000 },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.setDefaultTimeout(30_000);
    const elapsed = async action => {
      const start = await page.evaluate(() => performance.now());
      await action();
      return await page.evaluate(() => performance.now()) - start;
    };
    try {
      await page.addInitScript(() => { window.showDirectoryPicker = () => navigator.storage.getDirectory(); });
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '创建笔记库', exact: true }).click();
      await page.getByRole('button', { name: '创建笔记库', exact: true }).waitFor({state: 'hidden'});
      const body = Array.from({ length: Math.ceil(fixture.bodyChars / 100) }, (_, i) => `Paragraph ${i}: ${'writing content '.repeat(6)}\n`).join('\n') + '\nAUDIT_END';
      const header = id => `id: ${id}\ncreatedAt: 2026-10-29T00:00:00Z\nupdatedAt: 2026-10-29T00:00:00Z\n`;
      const target = `---\n${header(randomUUID())}${Array.from({length: fixture.properties}, (_, i) => `field${i}: ""\n`).join('')}---\n${body}`;
      const catalog = `---\n${header(randomUUID())}tags:\n${Array.from({length: fixture.tags}, (_, i) => `  - area/tag${i}\n`).join('')}---\nTag catalog`;
      await page.evaluate(async ({ target, catalog }) => {
        const root = await navigator.storage.getDirectory();
        for (const [name, source] of [['Audit.md', target], ['Catalog.md', catalog]]) {
          const writable = await (await root.getFileHandle(name, { create: true })).createWritable();
          await writable.write(source); await writable.close();
        }
      }, { target, catalog });
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '所有笔记', exact: true }).click();
      await page.getByRole('button', { name: '打开 Audit', exact: true }).waitFor();
      if (fixture.collapseSidebarTags) await page.getByRole('button', {name: '标签', exact: true, expanded: true}).click();
      const openNoteMs = await elapsed(async () => {
        await page.getByRole('button', { name: '打开 Audit', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[aria-label="笔记内容"]')?.textContent?.includes('AUDIT_END'));
      });
      const expandPropertyActionsMs = await elapsed(async () => {
        await page.getByRole('button', { name: '更多属性', exact: true }).click();
        await page.getByRole('button', { name: '添加属性', exact: true }).waitFor();
      });
      // Start before React's delegated pointer handler, excluding locator lookup.
      await page.evaluate(() => {
        document.addEventListener('pointerdown', event => {
          if (!(event.target instanceof Element) || !event.target.closest('button[aria-label="编辑标签"]')) return;
          performance.mark('tag-pointer');
          const ready = () => {
            if (!document.querySelector('[aria-label="可选属性标签"] [role="option"]')) return;
            observer.disconnect();
            requestAnimationFrame(() => requestAnimationFrame(() => {
              performance.mark('tag-painted');
              performance.measure('tag-pointer-to-paint', 'tag-pointer', 'tag-painted');
            }));
          };
          const observer = new MutationObserver(ready);
          observer.observe(document.body, {childList:true,subtree:true});
          ready();
        }, {once:true,capture:true});
      });
      const openTagsMs = await elapsed(async () => {
        await page.getByRole('button', { name: '编辑标签', exact: true }).click();
        await page.getByRole('option', { name: '属性标签 area/tag0', exact: true }).waitFor();
      });
      await page.waitForFunction(() => performance.getEntriesByName('tag-pointer-to-paint').length > 0);
      const pointerToPaintMs = await page.evaluate(() => Math.round(performance.getEntriesByName('tag-pointer-to-paint')[0].duration));
      const mountedTagOptions = await page.getByRole('option').count();
      if (fixture.tags > 100) assert.ok(mountedTagOptions < 40, 'Large tag lists must mount only a bounded viewport');
      const search = page.getByRole('combobox', { name: '搜索或新建属性标签', exact: true });
      const filterMs = [];
      for (const query of ['a', 'ar', 'are', 'area/t', 'area/ta']) filterMs.push(await elapsed(async () => {
        await search.fill(query);
        await page.getByRole('option', { name: `新建标签 ${query}`, exact: true }).waitFor();
      }));
      await search.press('Escape');
      const propertySaveMs = [];
      for (let i = 0; i < 5; i++) propertySaveMs.push(await elapsed(async () => {
        await page.getByRole('button', { name: '编辑属性 field0', exact: true }).click();
        await page.getByRole('textbox', { name: '属性值', exact: true }).fill(`saved-value-${i}`);
        await page.getByRole('textbox', { name: '属性值', exact: true }).press('Enter');
        await page.waitForFunction(async value => {
          const root = await navigator.storage.getDirectory();
          return (await (await root.getFileHandle('Audit.md')).getFile()).text().then(source => source.includes(value) && source.includes('AUDIT_END'));
        }, `saved-value-${i}`);
      }));
      await page.getByRole('navigation', {name: '当前位置', exact: true}).getByRole('button', {name: '所有笔记', exact: true}).click();
      await page.getByRole('button', {name: '打开 Audit', exact: true}).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="笔记内容"]')?.textContent?.includes('AUDIT_END'));
      const editor = page.getByRole('textbox', {name: '笔记内容', exact: true});
      await editor.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
      const bodyInputMs = [];
      let typed = '';
      for (const character of ['a', 'b', 'c', 'd', 'e']) bodyInputMs.push(await elapsed(async () => {
        typed += character;
        await editor.press(character);
        await page.waitForFunction(value => document.querySelector('[aria-label="笔记内容"]')?.textContent?.includes(value), `AUDIT_END${typed}`);
      }));
      await page.waitForFunction(async () => {
        const root = await navigator.storage.getDirectory();
        return (await (await root.getFileHandle('Audit.md')).getFile()).text().then(source => source.includes('AUDIT_ENDabcde') && source.includes('saved-value-4'));
      });
      await page.getByRole('navigation', { name: '当前位置', exact: true }).getByRole('button', { name: '所有笔记', exact: true }).click();
      await page.getByRole('button', {name: '打开 Audit', exact: true}).waitFor();
      const newNoteMs = await elapsed(async () => {
        await page.getByRole('button', { name: '新建笔记', exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '页面标题');
      });
      await page.getByRole('navigation', { name: '当前位置', exact: true }).getByRole('button', { name: '所有笔记', exact: true }).click();
      await page.getByRole('button', {name: '打开 Audit', exact: true}).waitFor();
      const fileCount = await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory(); let count = 0;
        for await (const [name, entry] of root.entries()) if (entry.kind === 'file' && name.endsWith('.md')) count++;
        return count;
      });
      assert.equal(fileCount, 2, 'Inspecting an empty new note must not create a file');
      assert.deepEqual(errors, []);
      const result = { ...fixture, actualBodyChars: body.length, openNoteMs: Math.round(openNoteMs), openTagsMs: Math.round(openTagsMs), pointerToPaintMs, mountedTagOptions, filter: summary(filterMs), expandPropertyActionsMs: Math.round(expandPropertyActionsMs), propertySave: summary(propertySaveMs), bodyInput: summary(bodyInputMs), newNoteMs: Math.round(newNoteMs), fileCount };
      results.push(result); console.log(JSON.stringify(result));
    } catch (error) {
      await mkdir(output, { recursive: true });
      await page.screenshot({path: `${output}${fixture.name}-failure.png`});
      console.error(fixture.name, (await page.locator('body').innerText()).slice(0, 3000));
      throw error;
    } finally { await context.close(); }
  }
  await mkdir(output, { recursive: true });
  await writeFile(`${output}${process.env.MEMOCARD_AUTHORING_BENCH_LABEL || 'current'}.json`, JSON.stringify({
    measuredAt: new Date().toISOString(), browser: await browser.version(), scope: 'Production web build with real isolated OPFS and IndexedDB; only the directory picker is substituted. Action-to-settled-DOM timings include automation overhead. expandPropertyActionsMs measures the footer/add-property actions; always-visible fields mount during openNoteMs. pointerToPaintMs starts at captured pointerdown and ends two animation frames after the first option mounts. One cold open and five warmed edits per fixture; not device FPS or native service/network latency.', results,
  }, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
