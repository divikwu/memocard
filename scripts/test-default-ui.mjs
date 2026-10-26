import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';

const uiRoot = fileURLToPath(new URL('../apps/ui/', import.meta.url));
const require = createRequire(`${uiRoot}package.json`);
const { chromium, webkit } = require('playwright');
let server;
let baseURL;
before(async () => {
  const { preview } = await import(require.resolve('vite'));
  server = await preview({ configFile: false, root: uiRoot, base: './', logLevel: 'error', build: { outDir: `${uiRoot}dist` }, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.httpServer.close(resolve)); });

for (const [engine, width] of [[chromium, 1440], [webkit, 390]]) {
  test(`default UI in ${engine.name()}: ${width === 1440 ? 'persist, reload, search, delete and restore' : 'connection guide and settings'}`, { timeout: 60_000 }, async () => {
    const browser = await engine.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      // The system picker is the only substituted boundary. Every subsequent read,
      // write, IndexedDB registration and recovery uses the browser's real OPFS.
      if (engine === chromium) await page.addInitScript(() => { window.showDirectoryPicker = () => navigator.storage.getDirectory(); });
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      await page.locator('.web-app').waitFor();
      assert.equal(await page.locator('.lucide').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (engine === chromium) {
        await page.getByRole('button', { name: '创建笔记库', exact: true }).click();
        await page.getByRole('button', { name: '新建笔记', exact: true }).first().click();
        await page.getByRole('textbox', { name: '页面标题', exact: true }).fill('Migration filesystem proof');
        await page.getByRole('textbox', { name: '笔记内容', exact: true }).fill('Persisted through the default UI. migrationproof');
        await page.getByRole('button', { name: '返回主页', exact: true }).click();
        await page.getByRole('button', { name: '打开 Migration filesystem proof', exact: true }).waitFor();
        const persisted = await page.evaluate(async () => {
          const root = await navigator.storage.getDirectory();
          const file = await (await root.getFileHandle('Migration filesystem proof.md')).getFile();
          return file.text();
        });
        assert.match(persisted, /migrationproof/);
        await page.reload({ waitUntil: 'networkidle' });
        await page.getByRole('button', { name: '打开 Migration filesystem proof', exact: true }).waitFor();
        await page.getByRole('button', { name: '搜索', exact: true }).click();
        await page.getByRole('combobox', { name: '搜索笔记', exact: true }).fill('migrationproof');
        await page.getByRole('option', { name: 'Migration filesystem proof', exact: true }).click();
        await page.getByRole('textbox', { name: '笔记内容', exact: true }).waitFor();
        await page.getByRole('button', { name: '页面操作', exact: true }).click();
        await page.getByRole('menuitem', { name: '移入回收站', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '将「Migration filesystem proof」移入回收站？', exact: true });
        await dialog.getByRole('button', { name: '移入回收站', exact: true }).click();
        await page.getByRole('button', { name: /^笔记库：/ }).click();
        await page.getByRole('menuitem', { name: '回收站', exact: true }).click();
        await page.getByRole('button', { name: '查看已删除笔记：Migration filesystem proof', exact: true }).click();
        await page.getByRole('button', { name: '恢复笔记', exact: true }).click();
        await page.getByRole('button', { name: '所有笔记', exact: true }).click();
        await page.getByRole('button', { name: '打开 Migration filesystem proof', exact: true }).waitFor();
        await page.getByText('Persisted through the default UI. migrationproof', { exact: true }).waitFor();
      } else {
        await page.getByRole('heading', { name: '通过本机服务连接笔记库' }).waitFor();
        await page.getByRole('button', { name: '页面操作', exact: true }).click();
        await page.getByRole('menuitem', { name: '设置', exact: true }).click();
        await page.getByRole('heading', { name: '外观', exact: true }).waitFor();
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}
