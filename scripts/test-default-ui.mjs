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
        await page.getByRole('button', { name: '创建笔记库', exact: true }).waitFor({state: 'hidden'});
        await page.getByRole('button', { name: '新建笔记', exact: true }).first().click();
        await page.getByRole('button', { name: '更多属性', exact: true }).click();
        await page.getByRole('button', { name: '编辑标签', exact: true }).click();
        await page.getByRole('combobox', { name: '搜索或新建属性标签', exact: true }).press('Escape');
        await page.getByRole('navigation', { name: '当前位置', exact: true }).getByRole('button', { name: '主页', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: /^打开 新内容/ }).count(), 0);
        assert.equal(await page.evaluate(async () => {
          const root = await navigator.storage.getDirectory();
          const files = [];
          for await (const [name, entry] of root.entries()) if (entry.kind === 'file' && name.endsWith('.md')) files.push(name);
          return files.length;
        }), 0);
        await page.getByRole('button', { name: '新建笔记', exact: true }).first().click();
        await page.getByRole('button', { name: '更多属性', exact: true }).click();
        await page.getByRole('button', { name: '编辑标签', exact: true }).click();
        await page.getByRole('combobox', { name: '搜索或新建属性标签', exact: true }).fill('tagfirstproof');
        await page.getByRole('option', { name: '新建标签 tagfirstproof', exact: true }).click();
        await page.waitForFunction(async () => {
          try { const root = await navigator.storage.getDirectory(); return (await (await root.getFileHandle('新内容.md')).getFile()).text().then(source => source.includes('tagfirstproof')); }
          catch { return false; }
        });
        await page.getByRole('combobox', { name: '搜索或新建属性标签', exact: true }).press('Escape');
        await page.getByRole('button', { name: '添加属性', exact: true }).click();
        await page.getByRole('textbox', { name: '属性名', exact: true }).fill('属性验证');
        await page.getByRole('button', { name: '文本', exact: true }).click();
        await page.getByRole('textbox', { name: '页面标题', exact: true }).fill('Migration filesystem proof');
        await page.getByRole('textbox', { name: '笔记内容', exact: true }).fill('Persisted through the default UI. migrationproof');
        await page.getByRole('navigation', { name: '当前位置', exact: true }).getByRole('button', { name: '主页', exact: true }).click();
        await page.getByRole('button', { name: '打开 Migration filesystem proof', exact: true }).waitFor();
        const persisted = await page.evaluate(async () => {
          const root = await navigator.storage.getDirectory();
          const file = await (await root.getFileHandle('Migration filesystem proof.md')).getFile();
          return file.text();
        });
        assert.match(persisted, /migrationproof/);
        assert.match(persisted, /tagfirstproof/);
        assert.match(persisted, /属性验证/);
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

test('property-first new note retains empty fields, zero, false and choice edits after reload', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => { window.showDirectoryPicker = () => navigator.storage.getDirectory(); });
    await page.goto(baseURL, {waitUntil: 'networkidle'});
    await page.getByRole('button', {name: '创建笔记库', exact: true}).click();
    await page.getByRole('button', {name: '创建笔记库', exact: true}).waitFor({state: 'hidden'});
    await page.getByRole('button', {name: '新建笔记', exact: true}).first().click();
    await page.getByRole('button', {name: '更多属性', exact: true}).click();
    const add = async (name, type) => {
      await page.getByRole('button', {name: '添加属性', exact: true}).click();
      await page.getByRole('textbox', {name: '属性名', exact: true}).fill(name);
      await page.getByRole('button', {name: type, exact: true}).click();
      await page.getByRole('dialog', {name: '添加属性', exact: true}).waitFor({state: 'hidden'});
    };
    await add('empty', '文本');
    const read = () => page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      return (await (await root.getFileHandle('新内容.md')).getFile()).text();
    });
    const {parse} = require('yaml');
    assert.equal(parse((await read()).split('---')[1]).empty, '');
    assert.equal((await read()).split('---')[2].trim(), '', 'Adding an empty custom property retains a bodyless note');
    await add('zero', '数字');
    await page.getByRole('button', {name: '编辑属性 zero', exact: true}).click();
    await page.getByRole('textbox', {name: '属性值', exact: true}).fill('0');
    await page.getByRole('textbox', {name: '属性值', exact: true}).press('Enter');
    await add('done', '复选框');
    await page.getByRole('checkbox', {name: '切换属性 done', exact: true}).check();
    await page.getByRole('checkbox', {name: '切换属性 done', exact: true}).uncheck();
    await add('stage', '选择');
    await page.getByRole('button', {name: '编辑属性 stage', exact: true}).click();
    await page.getByRole('combobox', {name: '搜索或创建选项', exact: true}).fill('a');
    await page.getByRole('combobox', {name: '搜索或创建选项', exact: true}).press('Enter');
    await page.getByRole('dialog', {name: '编辑属性 stage', exact: true}).waitFor({state: 'hidden'});
    await add('areas', '多选');
    await page.getByRole('button', {name: '编辑属性 areas', exact: true}).click();
    const search = page.getByRole('combobox', {name: '搜索或创建选项', exact: true});
    await search.fill('a'); await search.press('Enter');
    await page.getByRole('button', {name: '移除选项 a', exact: true}).waitFor();
    await search.fill('b'); await search.press('Enter');
    await page.getByRole('button', {name: '移除选项 b', exact: true}).waitFor();
    await page.getByRole('button', {name: '移除选项 a', exact: true}).click();
    await page.getByRole('button', {name: '移除选项 a', exact: true}).waitFor({state: 'hidden'});
    await search.press('Escape');
    await page.getByRole('navigation', {name: '当前位置', exact: true}).getByRole('button', {name: '主页', exact: true}).click();
    const properties = parse((await read()).split('---')[1]);
    assert.equal(properties.empty, '');
    assert.equal(properties.zero, 0);
    assert.equal(properties.done, false);
    assert.equal(properties.stage, 'a');
    assert.deepEqual(properties.areas, ['b']);
    await page.reload({waitUntil: 'networkidle'});
    await page.getByRole('button', {name: '打开 新内容', exact: true}).click();
    await page.getByRole('button', {name: '更多属性', exact: true}).click();
    await page.getByRole('button', {name: '编辑属性 zero', exact: true}).filter({hasText: '0'}).waitFor();
    await page.getByRole('button', {name: '编辑属性 stage', exact: true}).filter({hasText: 'a'}).waitFor();
    await page.getByRole('button', {name: '编辑属性 areas', exact: true}).filter({hasText: 'b'}).waitFor();
    assert.equal(await page.getByRole('checkbox', {name: '切换属性 done', exact: true}).isChecked(), false);
    await page.getByRole('button', {name: '新建笔记', exact: true}).first().click();
    await page.getByRole('button', {name: '更多属性', exact: true}).click();
    await page.getByRole('button', {name: '编辑属性 zero', exact: true}).waitFor({timeout: 2000});
    await page.getByRole('button', {name: '编辑属性 zero', exact: true}).click();
    await page.getByRole('textbox', {name: '属性值', exact: true}).fill('0');
    await page.getByRole('textbox', {name: '属性值', exact: true}).press('Enter');
    await page.getByRole('navigation', {name: '当前位置', exact: true}).getByRole('button', {name: '主页', exact: true}).click();
    await page.getByRole('button', {name: '打开 新内容 (2)', exact: true}).waitFor();
    const inherited = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      return (await (await root.getFileHandle('新内容 (2).md')).getFile()).text();
    });
    assert.equal(parse(inherited.split('---')[1]).zero, 0);
    assert.equal(inherited.split('---')[2].trim(), '');
  } finally { await browser.close(); }
});
