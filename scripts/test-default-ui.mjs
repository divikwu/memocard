import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { before, after, test } from 'node:test';

const uiRoot = fileURLToPath(new URL('../apps/ui/', import.meta.url));
const require = createRequire(`${uiRoot}package.json`);
const { chromium, webkit } = require('playwright');
let server;
let baseURL;
let manifest;
const openNotes = async page => {
  await page.getByRole('navigation', {name: '顶部导航'}).getByRole('button', {name: '笔记', exact: true}).click();
};
const topbarCreate = page => page.locator('.web-top-actions').getByRole('button', {name: '新建笔记', exact: true});
const newNote = async page => {
  await openNotes(page);
  await topbarCreate(page).click();
};
const returnToNotes = async page => {
  await page.getByRole('navigation', {name: '当前位置'}).getByRole('button', {name: '所有笔记', exact: true}).click();
  await page.getByRole('heading', {name: '所有笔记', level: 1, exact: true}).waitFor();
};
before(async () => {
  manifest = JSON.parse(await readFile(`${uiRoot}dist/.vite/manifest.json`, 'utf8'));
  const { preview } = await import(require.resolve('vite'));
  server = await preview({ configFile: false, root: uiRoot, base: './', logLevel: 'error', build: { outDir: `${uiRoot}dist` }, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.httpServer.close(resolve)); });

for (const [interfaceTheme, layout] of [['classic', 'rail'], ['minimal', 'topbar']]) {
  test(`cold start reserves the selected ${layout} layout while its navigation loads`, { timeout: 20_000 }, async () => {
    const browser = await chromium.launch();
    const gate = Promise.withResolvers();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.addInitScript(interfaceTheme => localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme })), interfaceTheme);
      const resource = manifest[`ui/web/layouts/${layout}.tsx`].file;
      const other = manifest[`ui/web/layouts/${layout === 'rail' ? 'topbar' : 'rail'}.tsx`].file;
      const requests = [];
      page.on('request', request => requests.push(request.url()));
      await page.route(`${baseURL}/${resource}`, async route => { await gate.promise; await route.continue(); });
      await page.goto(`${baseURL}/#/home`, { waitUntil: 'domcontentloaded' });
      await page.locator('.web-page-content[data-view=home]').waitFor();
      const frame = page.locator('.web-app');
      assert.equal(await frame.getAttribute('data-workspace-layout'), layout);
      assert.equal(await frame.getAttribute('data-interface-theme'), interfaceTheme);
      assert.equal(await page.getByRole('navigation', { name: '主要导航', exact: true }).count(), 0);
      const shell = frame.locator('.web-app-shell');
      const before = await shell.boundingBox();
      gate.resolve();
      await page.getByRole('navigation', { name: layout === 'rail' ? '桌面导航' : '顶部导航', exact: true }).waitFor();
      assert.deepEqual(await shell.boundingBox(), before);
      assert.ok(!requests.includes(`${baseURL}/${other}`));
    } finally { gate.resolve(); await browser.close(); }
  });
}

function recordRefreshFrames() {
  window.refreshFrames = new Set();
  function sample() {
    const content = document.querySelector('.web-page-content');
    if (content) {
      const layout = content.closest('.web-app').dataset.workspaceLayout;
      const oldSidebar = Boolean(document.querySelector('[data-slot="sidebar-container"]'));
      const { x, y, width } = content.getBoundingClientRect();
      window.refreshFrames.add(JSON.stringify([layout, content.dataset.view, content.hasAttribute('data-detail'), oldSidebar, x, y, width, getComputedStyle(content).paddingTop]));
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
}

async function assertStableRefresh(page, view, layout) {
  const frames = await page.evaluate(async () => {
    await new Promise(requestAnimationFrame);
    return Array.from(window.refreshFrames, value => JSON.parse(value));
  });
  assert.equal(frames.length, 1, JSON.stringify({ view, layout, frames }));
  assert.deepEqual(frames[0].slice(0, 4), [layout, view === 'detail' ? 'notes' : view, view === 'detail', false]);
}

function refreshGeometry(selectors = ['.web-app-shell', '.web-app-main', '.web-page-content', '.web-collection-heading h1', '.web-crumb', '.ui-note-cards', '.ui-note-list', '.ui-tag-directory-panel', '.ui-tag-directory-groups', '.note-page-title']) {
  return Object.fromEntries(selectors.flatMap(selector => {
    const element = document.querySelector(selector);
    if (!element) return [];
    const { x, y, width } = element.getBoundingClientRect();
    const { paddingTop, paddingLeft } = getComputedStyle(element);
    return [[selector, [x, y, width, paddingTop, paddingLeft]]];
  }));
}

for (const [interfaceTheme, desktopLayout] of [['classic', 'rail'], ['minimal', 'topbar']]) {
  test(`refresh preserves collection and detail geometry in ${interfaceTheme}`, { timeout: 60_000 }, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.setDefaultTimeout(5000);
      await page.addInitScript(theme => {
        window.showDirectoryPicker = () => navigator.storage.getDirectory();
        localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme: theme }));
      }, interfaceTheme);
      await page.addInitScript(recordRefreshFrames);
      await page.goto(baseURL + '/#/notes');
      await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        const file = await root.getFileHandle('Refresh proof.md', { create: true });
        const stream = await file.createWritable();
        await stream.write('---\ntags: [refresh]\n---\nExample body.');
        await stream.close();
      });
      await page.getByRole('button', { name: '打开已有笔记库', exact: true }).click();
      const note = page.getByRole('button', { name: '打开 Refresh proof', exact: true });
      await note.click();
      const editor = page.getByRole('textbox', { name: '笔记内容', exact: true });
      await editor.waitFor();
      const routes = [
        ['notes', '#/notes', note],
        ['tags', '#/tags', page.locator('.ui-tag-directory-groups')],
        ['detail', new URL(page.url()).hash, editor],
      ];
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [view, hash, ready] of routes) {
          await page.goto(baseURL + '/' + hash);
          await ready.waitFor();
          const gate = Promise.withResolvers();
          const layout = width < 768 ? 'drawer' : desktopLayout;
          const resources = [manifest[`ui/web/appearance/themes/${interfaceTheme}.css?inline`].file];
          if (layout !== 'drawer') resources.push(manifest[`ui/web/layouts/${layout}.tsx`].file);
          const hold = async route => { await gate.promise; await route.continue(); };
          try {
            for (const file of resources) await page.route(baseURL + '/' + file, hold);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await ready.waitFor();
            const frame = page.locator('.web-app');
            assert.equal(await frame.getAttribute('data-workspace-layout'), layout);
            assert.equal(await page.getByRole('navigation', { name: '主要导航', exact: true }).count(), 0);
            const before = await page.evaluate(refreshGeometry);
            gate.resolve();
            await page.locator(`style[data-workspace-style="${interfaceTheme}"]`).waitFor({ state: 'attached' });
            if (layout === 'rail' && view === 'detail') await page.getByRole('button', { name: '导航菜单' }).waitFor();
            else if (layout !== 'drawer') await page.getByRole('navigation', { name: layout === 'rail' ? '桌面导航' : '顶部导航', exact: true }).waitFor();
            assert.deepEqual(await page.evaluate(refreshGeometry), before, `${view}, ${width}px, ${layout}`);
            await assertStableRefresh(page, view, layout);
          } finally {
            gate.resolve();
            for (const file of resources) await page.unroute(baseURL + '/' + file, hold);
          }
        }
      }
    } finally { await browser.close(); }
  });
}

test('refresh and layout switches keep the note toolbar and first row in place', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch();
  const html = (await readFile(uiRoot + 'dist/index.html', 'utf8')).replace('<head>', '<head><meta name="memocard-local-web" content="1">');
  const notes = Array.from({ length: 32 }, (_, i) => ({
    id: String(i), sourceUrl: i + '.md', relativePath: i + '.md', contentHash: 'hash', title: 'Note ' + i, body: 'Example', tags: [],
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  }));
  try {
    for (const width of [1440, 390]) for (const theme of ['classic', 'minimal']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const capabilities = ['getStatus', 'queryNotes', 'getNote', 'saveNote'];
      const coverage = { complete: true, indexed: notes.length, pending: 0, issues: 0 };
      let pending;
      try {
        await page.addInitScript(theme => {
          localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme: theme }));
          requestAnimationFrame(function firstCollectionFrame() {
            const collection = document.querySelector('.ui-note-collection');
            if (collection) window.firstCollectionLayout = collection.dataset.layout;
            else requestAnimationFrame(firstCollectionFrame);
          });
        }, theme);
        await page.route(baseURL + '/', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.route(baseURL + '/api/bridge', async route => {
          const { operation } = route.request().postDataJSON();
          let data;
          if (operation === 'getEnvironment') data = { platform: 'mac', storage: 'local-web', capabilities };
          else if (operation === 'getStatus') data = { connected: true, vaultId: 'test', vaultName: 'Test', capabilities, coverage };
          else {
            assert.equal(operation, 'queryNotes');
            await pending?.promise;
            data = { notes, nextCursor: null, coverage };
          }
          await route.fulfill({ json: { ok: true, data } });
        });
        const switchTo = async layout => {
          if (width < 768) {
            await page.getByRole('button', { name: /^视图选项/ }).click();
            await page.getByRole('menuitemradio', { name: layout === 'cards' ? '卡片' : '列表', exact: true }).click();
          } else await page.getByRole('button', { name: layout === 'cards' ? '卡片布局' : '列表布局', exact: true }).click();
        };
        const measure = (layout, loading) => page.locator(`.ui-note-collection[data-layout=${layout}] ${loading ? '[data-slot=collection-skeleton]' : 'ul.ui-note-items'}`).evaluate((items, loading) => {
          const scroller = items.closest('.web-app-scroll');
          const toolbar = items.closest('.ui-note-collection').querySelector('.ui-note-toolbar');
          const rect = element => {
            const { x, y, width, height } = element.getBoundingClientRect();
            return [x, y, width, height];
          };
          return { toolbar: rect(toolbar), first: rect(items.firstElementChild), scroll: scroller.scrollTop,
            excess: loading ? scroller.scrollHeight - scroller.clientHeight : 0 };
        }, loading);
        for (const view of ['home', 'notes']) {
          await page.goto(baseURL + '/#/' + view);
          await page.locator('ul.ui-note-items').waitFor();
          for (const layout of ['cards', 'list']) {
            const other = layout === 'cards' ? 'list' : 'cards';
            await switchTo(layout);
            const ready = await measure(layout, false);
            pending = Promise.withResolvers();
            await page.reload({ waitUntil: 'domcontentloaded' });
            const loading = await measure(layout, true);
            assert.equal(await (await page.waitForFunction(() => window.firstCollectionLayout)).jsonValue(), layout);
            assert.deepEqual(loading, ready, `${theme} ${view} ${width}px refresh ${layout}`);
            if (width === 1440 && theme === 'minimal' && view === 'home' && layout === 'list') {
              const top = await page.locator('[data-slot=collection-skeleton]').evaluate(items => items.getBoundingClientRect().top);
              await page.setViewportSize({ width, height: Math.ceil(top) + 8 });
              await page.waitForFunction(() => {
                const scroller = document.querySelector('.web-app-scroll');
                return scroller.scrollHeight === scroller.clientHeight;
              });
              await page.setViewportSize({ width, height: 900 });
            }
            await switchTo(other);
            const switched = await measure(other, true);
            assert.deepEqual(switched.toolbar, ready.toolbar);
            pending.resolve();
            assert.deepEqual(await measure(other, false), switched, `${theme} ${view} ${width}px switched to ${other}`);
          }
        }
      } finally { pending?.resolve(); await page.close(); }
    }
  } finally { await browser.close(); }
});

for (const view of ['settings', 'trash']) {
  test(`refresh keeps the ${view} layout while the vault, page and theme load`, { timeout: 60_000 }, async () => {
    const browser = await chromium.launch();
    const html = (await readFile(`${uiRoot}dist/index.html`, 'utf8')).replace('<head>', '<head><meta name="memocard-local-web" content="1">');
    const feature = manifest[view === 'settings' ? 'ui/web/WebSettings.tsx' : 'ui/business/TrashPage.tsx'].file;
    try {
      for (const width of [1440, 390]) for (const [theme, desktop] of [['classic', 'rail'], ['minimal', 'topbar']]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        page.setDefaultTimeout(5000);
        const vault = Promise.withResolvers(), featureCode = Promise.withResolvers(), appearance = Promise.withResolvers(), rows = Promise.withResolvers();
        const layout = width < 768 ? 'drawer' : desktop;
        const context = `${view}, ${theme}, ${width}px`;
        const surface = page.locator(view === 'settings' ? '.web-settings' : '.ui-trash');
        try {
          let connected = true;
          await page.addInitScript(recordRefreshFrames);
          await page.addInitScript(theme => localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme: theme })), theme);
          await page.goto(baseURL + '/#/' + view);
          await page.route(baseURL + '/', route => route.fulfill({ contentType: 'text/html', body: html }));
          await page.route(baseURL + '/api/bridge', async route => {
            const { operation } = route.request().postDataJSON();
            const capabilities = ['getEnvironment', 'getStatus', 'getTrash', 'restoreNote', 'permanentlyDeleteNote'];
            let data;
            if (operation === 'getEnvironment') data = { platform: 'mac', storage: 'local-web', capabilities };
            else if (operation === 'getStatus') {
              await vault.promise;
              data = { connected, ...(connected && { vaultId: 'refresh', vaultName: 'Refresh' }), capabilities, coverage: { complete: true, indexed: 0, pending: 0, issues: 0 } };
            } else {
              assert.equal(operation, 'getTrash');
              await rows.promise;
              data = { notes: [{ trashKey: 'example', title: 'Example', relativePath: 'Example.md', deletedAt: '2026-01-01T00:00:00Z' }], issues: [] };
            }
            await route.fulfill({ json: { ok: true, data } });
          });
          await page.route(baseURL + '/' + feature, async route => { await featureCode.promise; await route.continue(); });
          for (const file of [manifest[`ui/web/appearance/themes/${theme}.css?inline`].file, ...(layout === 'drawer' ? [] : [manifest[`ui/web/layouts/${layout}.tsx`].file])]) {
            await page.route(baseURL + '/' + file, async route => { await appearance.promise; await route.continue(); });
          }
          await page.reload({ waitUntil: 'domcontentloaded' });
          await page.locator(`.web-page-content[data-view=${view}]`).waitFor();
          assert.equal(await page.locator('.web-app').getAttribute('data-workspace-layout'), layout, context);
          assert.equal(await page.getByRole('navigation', { name: '主要导航', exact: true }).count(), 0, context);
          await surface.waitFor();
          const measure = () => page.evaluate(refreshGeometry, view === 'settings'
            ? ['.web-settings-title', '.web-settings-panel', '.web-settings-panel > section:first-of-type > [data-slot=card]', '.web-setting-section-heading']
            : ['.ui-trash > header', '.ui-trash h1', '.ui-trash-list', '.ui-trash-card']);
          const initial = await measure();
          const stages = [initial];
          if (view === 'settings' && width < 768) {
            const downloaded = page.waitForResponse(baseURL + '/' + feature);
            featureCode.resolve();
            await downloaded;
            assert.equal(await page.getByText('尚未连接笔记库', { exact: true }).count(), 0, context);
          }
          vault.resolve();
          if (view === 'settings' && width >= 768) {
            await page.locator('[data-slot=settings-skeleton] .web-setting-section-heading').waitFor();
            stages.push(await measure());
          }
          const requestedRows = view === 'trash' && page.waitForRequest(request => request.url().endsWith('/api/bridge') && request.postDataJSON()?.operation === 'getTrash');
          featureCode.resolve();
          if (requestedRows) await requestedRows;
          else await page.getByText('本机文件状态', { exact: true }).waitFor();
          stages.push(await measure());
          appearance.resolve();
          rows.resolve();
          await page.locator(`style[data-workspace-style="${theme}"]`).waitFor({ state: 'attached' });
          if (layout !== 'drawer') await page.getByRole('navigation', { name: layout === 'rail' ? '桌面导航' : '顶部导航', exact: true }).waitFor();
          if (view === 'trash') await page.getByRole('list', { name: '已删除笔记' }).waitFor();
          const final = await measure();
          for (const stage of stages) {
            for (const [selector, box] of Object.entries(stage)) assert.deepEqual(box, final[selector], `${context} ${selector}`);
          }
          await assertStableRefresh(page, view, layout);
          connected = false;
          await page.reload();
          await page.getByText(view === 'settings' ? '尚未连接笔记库' : '连接笔记库后查看回收站', { exact: true }).waitFor();
          const disconnected = await measure();
          const title = view === 'settings' ? '.web-settings-title' : '.ui-trash > header';
          assert.deepEqual(disconnected[title], final[title], context);
        } finally {
          for (const gate of [vault, featureCode, appearance, rows]) gate.resolve();
          await page.close();
        }
      }
    } finally { await browser.close(); }
  });
}

test('mobile refresh can open the drawer before theme styles finish loading', { timeout: 20_000 }, async () => {
  const browser = await chromium.launch();
  const gate = Promise.withResolvers();
  const desktop = Promise.withResolvers();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.addInitScript(() => localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme: 'minimal' })));
    const styles = manifest['ui/web/appearance/themes/minimal.css?inline'].file;
    await page.route(`${baseURL}/${styles}`, async route => { await gate.promise; await route.continue(); });
    await page.goto(`${baseURL}/#/home`, { waitUntil: 'domcontentloaded' });
    const pageFrame = page.locator('.web-app');
    await page.getByRole('button', { name: '打开导航', exact: true }).waitFor();
    assert.equal(await pageFrame.getAttribute('data-workspace-layout'), 'drawer');
    assert.equal(await pageFrame.getAttribute('data-interface-theme'), 'minimal');
    assert.equal(await page.getByRole('navigation', { name: '主要导航', exact: true }).count(), 0);
    await page.getByRole('button', { name: '打开导航', exact: true }).click();
    await page.getByRole('dialog').getByRole('navigation', { name: '主要导航', exact: true }).waitFor();
    gate.resolve();
    await page.locator('style[data-workspace-style="minimal"]').waitFor({ state: 'attached' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    const resource = baseURL + '/' + manifest['ui/web/layouts/topbar.tsx'].file;
    await page.route(resource, async route => { await desktop.promise; await route.continue(); });
    const requested = page.waitForRequest(resource);
    await page.setViewportSize({ width: 1024, height: 844 });
    await requested;
    assert.equal(await pageFrame.getAttribute('data-workspace-layout'), 'topbar');
    assert.equal(await page.getByRole('navigation', { name: '主要导航', exact: true }).count(), 0);
    desktop.resolve();
    await page.getByRole('navigation', { name: '顶部导航', exact: true }).waitFor();
  } finally { gate.resolve(); desktop.resolve(); await browser.close(); }
});

test('applies the stored system scheme before React loads and follows later system changes', { timeout: 20_000 }, async () => {
  const browser = await chromium.launch();
  const gate = Promise.withResolvers();
  try {
    const page = await browser.newPage({ colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ theme: 'system' })));
    await page.route(baseURL + '/' + manifest['index.html'].file, async route => { await gate.promise; await route.continue(); });
    await page.goto(baseURL + '/#/settings', { waitUntil: 'commit' });
    await page.locator('html[data-ui-theme=dark] body').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#root').innerHTML(), '');
    assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'dark');
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#0a0a0a');
    gate.resolve();
    await page.getByRole('heading', { name: '设置', exact: true }).waitFor();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.locator('html[data-ui-theme=light]').waitFor();
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#ffffff');
  } finally { gate.resolve(); await browser.close(); }
});

test('recovers from a failed layout download in the production UI', { timeout: 20_000 }, async () => {
  const browser = await chromium.launch();
  const gate = Promise.withResolvers();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme: 'classic' })));
    const resource = manifest['ui/web/layouts/rail.tsx'].file;
    const layoutURL = `${baseURL}/${resource}`;
    await page.route(layoutURL, route => route.abort());
    await page.goto(`${baseURL}/#/settings`, { waitUntil: 'domcontentloaded' });
    const retry = page.getByRole('button', { name: '重试加载界面主题', exact: true });
    await retry.waitFor({ timeout: 5000 });
    await page.getByRole('navigation', { name: '主要导航', exact: true }).waitFor({ timeout: 5000 });
    await page.unroute(layoutURL);
    await page.route(layoutURL, async route => { await gate.promise; await route.continue(); });
    const requested = page.waitForRequest(layoutURL);
    await retry.click();
    await requested;
    assert.equal(await page.getByRole('navigation', { name: '主要导航', exact: true }).isVisible(), true);
    gate.resolve();
    await page.getByRole('navigation', { name: '桌面导航', exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator('.web-app[data-workspace-layout=rail]').evaluate(element => getComputedStyle(element).display), 'grid');
    await retry.waitFor({ state: 'detached' });
  } finally { gate.resolve(); await browser.close(); }
});

for (const [interfaceTheme, oldBuild] of [['classic', true], ['minimal', true], ['minimal', false]]) {
  test(`local Web drawer in ${interfaceTheme} ${oldBuild ? 'refreshes an obsolete page' : 'keeps retry for a current page'} following a 404`, { timeout: 20_000 }, async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1205, height: 900 } });
      page.setDefaultTimeout(5000);
      await page.addInitScript(theme => localStorage.setItem('memocard-web-appearance-v1', JSON.stringify({ interfaceTheme: theme })), interfaceTheme);
      const entry = manifest['index.html'].file;
      const drawer = manifest['ui/web/WebMoreDrawer.tsx'].file;
      const html = (await readFile(`${uiRoot}dist/index.html`, 'utf8')).replace('<head>', '<head><meta name="memocard-local-web" content="1">');
      let updateAvailable = false, newDocument = false, failedDrawerRequests = 0;
      await page.route(baseURL + '/', route => {
        newDocument = updateAvailable;
        return route.fulfill({ contentType: 'text/html', headers: { 'cache-control': 'no-store' }, body: html });
      });
      const classic = interfaceTheme === 'classic';
      const path = classic ? '#/settings' : '#/tags';
      await page.route(baseURL + '/api/bridge', route => {
        if (!classic) return route.fulfill({ status: 401, json: {} });
        const { operation } = route.request().postDataJSON();
        const capabilities = ['getStatus', 'getEnvironment'];
        const data = operation === 'getEnvironment' ? { platform: 'mac', storage: 'local-web', capabilities }
          : { connected: false, capabilities, coverage: { complete: true, indexed: 0, pending: 0, issues: 0 } };
        assert.ok(capabilities.includes(operation), operation);
        return route.fulfill({ json: { ok: true, data } });
      });
      await page.route(baseURL + '/' + entry, route =>
        oldBuild && updateAvailable && !newDocument ? route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: '' }) : route.continue());
      await page.route(baseURL + '/' + drawer, route => {
        if (newDocument) return route.continue();
        failedDrawerRequests++;
        return route.fulfill({ status: 404, headers: { 'cache-control': 'no-store' }, body: '' });
      });
      await page.goto(baseURL + '/' + path);
      const title = classic ? '切换笔记库' : '更多';
      const trigger = page.getByRole('button', { name: classic ? '笔记库操作（打开）' : '更多', exact: true });
      await trigger.waitFor();
      updateAvailable = true;
      await trigger.click();
      const retry = page.getByRole('button', { name: `重试加载${title}`, exact: true });
      const refresh = page.getByRole('button', { name: '刷新页面', exact: true });
      if (oldBuild) {
        await refresh.waitFor({ timeout: 5000 });
        assert.equal(await retry.count(), 0);
        const requestsBeforeRefresh = failedDrawerRequests;
        assert.ok(requestsBeforeRefresh > 0);
        assert.equal(newDocument, false);
        await Promise.all([page.waitForEvent('load'), refresh.click()]);
        await page.getByRole('heading', { name: classic ? '设置' : '标签', exact: true }).waitFor();
        await trigger.click();
        await page.getByRole('dialog', { name: title, exact: true }).waitFor();
        assert.equal(new URL(page.url()).hash, path);
        assert.equal(failedDrawerRequests, requestsBeforeRefresh);
      } else {
        await retry.waitFor({ timeout: 5000 });
        assert.equal(await refresh.count(), 0);
      }
    } finally { await browser.close(); }
  });
}

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
      await page.locator('.web-app[data-interface-theme="minimal"]').waitFor();
      assert.equal(await page.locator('.lucide').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (engine === chromium) {
        await page.getByRole('button', { name: '创建笔记库', exact: true }).click();
        await page.getByRole('button', { name: '创建笔记库', exact: true }).waitFor({state: 'hidden'});
        await newNote(page);
        await page.getByRole('button', { name: '更多属性', exact: true }).click();
        await page.getByRole('button', { name: '编辑标签', exact: true }).click();
        await page.getByRole('combobox', { name: '搜索或新建属性标签', exact: true }).press('Escape');
        assert.equal(await page.getByRole('navigation', { name: '桌面导航' }).count(), 0);
        assert.equal(await page.getByRole('button', { name: '返回笔记列表', exact: true }).count(), 1);
        await returnToNotes(page);
        assert.equal(await page.getByRole('button', { name: /^打开 新内容/ }).count(), 0);
        assert.equal(await page.evaluate(async () => {
          const root = await navigator.storage.getDirectory();
          const files = [];
          for await (const [name, entry] of root.entries()) if (entry.kind === 'file' && name.endsWith('.md')) files.push(name);
          return files.length;
        }), 0);
        await newNote(page);
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
        await returnToNotes(page);
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
        const noteBody = page.getByRole('textbox', { name: '笔记内容', exact: true });
        await noteBody.waitFor();
        const detailURL = page.url();
        await page.reload({ waitUntil: 'networkidle' });
        assert.match(await noteBody.textContent(), /Persisted through the default UI\. migrationproof/);
        assert.equal(page.url(), detailURL);
        await page.getByRole('button', { name: '页面操作', exact: true }).click();
        await page.getByRole('menuitem', { name: '移入回收站', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: '将「Migration filesystem proof」移入回收站？', exact: true });
        await dialog.getByRole('button', { name: '移入回收站', exact: true }).click();
        await page.getByRole('button', { name: '更多', exact: true }).click();
        await page.getByRole('dialog', {name: '更多', exact: true}).getByRole('button', { name: '回收站', exact: true }).click();
        await page.getByRole('button', { name: '查看已删除笔记：Migration filesystem proof', exact: true }).click();
        await page.getByRole('button', { name: '恢复笔记', exact: true }).click();
        await openNotes(page);
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
    await newNote(page);
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
    await returnToNotes(page);
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
    await topbarCreate(page).click();
    await page.getByRole('button', {name: '更多属性', exact: true}).click();
    await page.getByRole('button', {name: '编辑属性 zero', exact: true}).waitFor({timeout: 2000});
    await page.getByRole('button', {name: '编辑属性 zero', exact: true}).click();
    await page.getByRole('textbox', {name: '属性值', exact: true}).fill('0');
    await page.getByRole('textbox', {name: '属性值', exact: true}).press('Enter');
    await returnToNotes(page);
    await page.getByRole('button', {name: '打开 新内容 (2)', exact: true}).waitFor();
    const inherited = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      return (await (await root.getFileHandle('新内容 (2).md')).getFile()).text();
    });
    assert.equal(parse(inherited.split('---')[1]).zero, 0);
    assert.equal(inherited.split('---')[2].trim(), '');
  } finally { await browser.close(); }
});

test('home and all-notes galleries start at the first readable cover and fall back to text', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch();
  const gate = Promise.withResolvers();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.showDirectoryPicker = () => navigator.storage.getDirectory();
      localStorage.setItem('memocard:home-layout', 'cards');
      localStorage.setItem('memocard:note-layout', 'cards');
    });
    await page.goto(baseURL);
    await page.getByRole('button', { name: '创建笔记库', exact: true }).click();
    await page.getByRole('button', { name: '创建笔记库', exact: true }).waitFor({ state: 'hidden' });
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      async function write(directory, name, data) {
        const stream = await (await directory.getFileHandle(name, { create: true })).createWritable();
        await stream.write(data);
        await stream.close();
      }
      const assets = await root.getDirectoryHandle('assets', { create: true });
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      for (const [name, color] of [['property.png', '#00ff00'], ['later.png', '#ff0000'], ['body.png', '#0000ff']]) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        await write(assets, name, await new Promise(resolve => canvas.toBlob(resolve)));
      }
      // A recognized PNG signature with no decodable image data.
      await write(assets, 'corrupt.png', new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]));
      const meta = await root.getDirectoryHandle('.memocard');
      await write(meta, 'property-layout.json', JSON.stringify({
        order: ['property:missing', 'property:corrupt', 'property:chosen', 'property:later', 'property:hidden', 'property:empty', 'property:z'],
        visibility: { 'property:hidden': 'hidden' },
      }));
      const image = (field, file) => field + ': "./assets/' + file + '" # memocard:type=image\n';
      const missing = image('missing', 'missing.png') + image('corrupt', 'corrupt.png');
      const fields = 'a: Alphabetical fallback\nz: "Chosen **literal** text"\nhidden: Hidden text\nempty: "   "\n';
      const bodyImage = 'BODY CONTENT\n\n![Missing body](./assets/missing-body.png)\n\n![Body cover](./assets/body.png)\n\n![Later image](./assets/later.png)';
      const rows = [
        ['Property cover', missing + image('later', 'later.png') + image('chosen', 'property.png') + fields, bodyImage],
        ['Body cover', fields, bodyImage],
        ['Alias duplicate', image('chosen', 'body.png'), '字'.repeat(100) + '\n\n![[body.png]]'],
        ['Property only', image('chosen', 'property.png'), '字'.repeat(100)],
        ['Hidden cover', image('hidden', 'property.png'), '字'.repeat(100)],
        ['Text fallback', missing + fields, 'BODY CONTENT\n\n![Broken body](./assets/corrupt.png)'],
        ['Body fallback', missing, 'BODY CONTENT\n\n![Broken body](./assets/corrupt.png)'],
      ];
      for (const [title, header, body] of rows) await write(root, title + '.md', '---\n' + header + '---\n' + body);
    });
    const preview = title => page.locator('.ui-note-card').filter({
      has: page.getByRole('button', { name: '打开 ' + title, exact: true }),
    }).locator('.ui-note-preview, .ui-note-cover-slot:not(:empty)');
    const color = async (card, single = false) => {
      const img = card.locator(single ? '[data-text-cover][data-image-state="loaded"] img' : '[data-slot=carousel-item]:first-child [data-image-state="loaded"] img');
      await card.scrollIntoViewIfNeeded();
      await img.waitFor();
      if (single) {
        assert.equal(await card.locator('img').count(), 1);
        assert.equal(await card.getByRole('group', { name: '选择图片' }).count(), 0);
      } else await card.getByRole('group', { name: '选择图片' }).waitFor();
      assert.equal(await card.locator('.ui-note-preview').count(), 0);
      return img.evaluate(image => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      });
    };
    for (const route of ['home', 'notes']) {
      await page.goto(baseURL + '/#/' + route);
      const file = baseURL + '/' + manifest['ui/business/NoteCardPreview.tsx'].file;
      if (route === 'home') await page.route(file, async request => { await gate.promise; await request.continue(); });
      await page.reload({ waitUntil: 'domcontentloaded' });
      const coverTitles = ['Property cover', 'Body cover'];
      const assertCoverLayout = async () => {
        for (const title of coverTitles) {
          const button = page.getByRole('button', { name: '打开 ' + title, exact: true });
          await button.waitFor();
          const slot = preview(title);
          await slot.locator(':scope > *').first().waitFor();
          assert.ok(await button.locator('span').isHidden());
          assert.equal((await slot.boundingBox()).height, (await button.boundingBox()).height);
        }
      };
      if (route === 'home') await assertCoverLayout();
      gate.resolve();
      assert.deepEqual(await color(preview('Property cover')), [0, 255, 0, 255]);
      assert.deepEqual(await color(preview('Body cover')), [0, 0, 255, 255]);
      await assertCoverLayout();
      assert.deepEqual(await color(preview('Alias duplicate'), true), [0, 0, 255, 255]);
      await page.getByRole('button', {name:'打开 Alias duplicate', exact:true}).locator('span').waitFor();
      if (route === 'home') await page.unroute(file);
      for (const [title, expected] of [['Text fallback', 'Chosen **literal** text'], ['Body fallback', 'BODY CONTENT']]) {
        const card = preview(title);
        await card.scrollIntoViewIfNeeded();
        await card.getByText(expected, { exact: true }).waitFor();
        assert.equal((await card.innerText()).trim(), expected);
        assert.equal(await card.locator('img').count(), 0);
      }
    }
    await page.getByRole('button', {name:'打开 Alias duplicate',exact:true}).click();
    await page.getByRole('button', {name:'编辑内容类型'}).getByText('文字', {exact:true}).waitFor();
    await returnToNotes(page);
    await page.getByRole('tab', {name:'有图片'}).click();
    await page.getByRole('button', {name:'打开 Property only',exact:true}).waitFor();
    await page.getByRole('button', {name:'打开 Hidden cover',exact:true}).waitFor({state:'detached'});
    await page.getByRole('tab', {name:'全部类型'}).click();
    const carousel = preview('Body cover').getByRole('group', { name: '笔记图片' });
    await carousel.scrollIntoViewIfNeeded();
    const indicator = carousel.getByRole('group', {name:'选择图片'});
    const dots = indicator.getByRole('button');
    // Focus restoration or scrollIntoView must not offset Embla's translated track.
    assert.equal(await carousel.locator('[data-slot="carousel-content"]').evaluate(viewport => {
      viewport.scrollLeft = viewport.clientWidth;
      return viewport.scrollLeft;
    }), 0);
    await carousel.getByText('1 / 2', {exact:true}).waitFor();
    assert.equal(await dots.count(), 2);
    assert.equal(await dots.first().getAttribute('aria-current'), 'true');
    await page.mouse.move(0, 0);
    const firstDot = await dots.first().elementHandle();
    const idleWidth = (await dots.first().boundingBox()).width;
    await indicator.hover();
    await page.waitForFunction(({el, width}) => el.getBoundingClientRect().width >= width * 1.8,
      {el:firstDot, width:idleWidth});
    await dots.last().click();
    await carousel.getByRole('button', {name:'打开笔记 · Later image'}).waitFor();
    await page.mouse.move(0, 0);
    await page.waitForFunction(({el, width}) => el.getBoundingClientRect().width <= width + 0.5,
      {el:firstDot, width:idleWidth});
    await dots.first().press('Enter');
    await carousel.getByRole('button', {name:'打开笔记 · Body cover'}).waitFor();
    assert.ok(page.url().endsWith('/#/notes'));
    await page.mouse.move(0, 0);
    await carousel.hover();
    assert.equal(await carousel.getByRole('button', {name:/^(上一张|下一张)图片$/, includeHidden:true}).count(), 0);
    await dots.first().focus();
    await page.keyboard.press('ArrowLeft');
    await carousel.getByText('2 / 2', { exact: true }).waitFor();
    assert.ok(await dots.last().evaluate(button => button === document.activeElement));
    assert.equal(await carousel.getByRole('button', {name:/打开笔记/}).count(), 1);
    await carousel.getByRole('button', {name:'打开笔记 · Later image'}).waitFor();
    await page.keyboard.press('ArrowRight');
    await carousel.getByText('1 / 2', { exact: true }).waitFor();
    assert.ok(await dots.first().evaluate(button => button === document.activeElement));
    await carousel.getByRole('button', {name:'打开笔记 · Body cover'}).waitFor();
    const bounds = await carousel.boundingBox();
    const x = bounds.x + bounds.width * 0.8;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - bounds.width * 0.65, y, { steps: 10 });
    await page.mouse.up();
    await carousel.getByText('2 / 2', { exact: true }).waitFor();
    assert.ok(page.url().endsWith('/#/notes'), 'Dragging a cover must keep the note list open');
    await dots.last().focus();
    await page.keyboard.press('ArrowLeft');
    await carousel.getByText('1 / 2', { exact: true }).waitFor();
    const firstSlide = carousel.getByRole('button', {name:'打开笔记 · Body cover'});
    await page.waitForFunction(slide => Math.abs(slide.getBoundingClientRect().left -
      slide.closest('[data-slot="carousel-content"]').getBoundingClientRect().left) < 1, await firstSlide.elementHandle());
    await firstSlide.hover();
    for (let step = 0; step < 8; step++) await page.mouse.wheel(bounds.width / 10, 0);
    await carousel.getByText('2 / 2', { exact: true }).waitFor();

    await page.setViewportSize({ width: 390, height: 340 });
    await carousel.scrollIntoViewIfNeeded();
    const viewport = await carousel.evaluateHandle(node => {
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
      }
      return document.scrollingElement;
    });
    const oldScroll = await viewport.evaluate(el => el.scrollTop);
    const scrollDown = await viewport.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop > 10);
    await carousel.hover();
    await page.mouse.wheel(0, scrollDown ? 110 : -110);
    await page.waitForFunction(({ viewport, oldScroll }) =>
      Math.abs(viewport.scrollTop - oldScroll) > 5, { viewport, oldScroll });
    await carousel.getByText('2 / 2', { exact: true }).waitFor();
    await carousel.scrollIntoViewIfNeeded();
    const touch = await page.context().newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    for (const [dot, position] of [[dots.first(), '1 / 2'], [dots.last(), '2 / 2']]) {
      const box = await dot.boundingBox();
      await touch.send('Input.dispatchTouchEvent', {type:'touchStart',
        touchPoints:[{x:box.x + box.width / 2, y:box.y + box.height / 2}]});
      await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
      await carousel.getByText(position, {exact:true}).waitFor();
      assert.ok(page.url().endsWith('/#/notes'));
    }
    // Selection changes before the track finishes moving to the selected slide.
    const selectedSlide = carousel.locator('[data-slot="carousel-item"]:not([inert])');
    await page.waitForFunction(slide => Math.abs(slide.getBoundingClientRect().left -
      slide.closest('[data-slot="carousel-content"]').getBoundingClientRect().left) < 1, await selectedSlide.elementHandle());
    const touchBounds = await carousel.boundingBox();
    const finger = progress => [{ x: touchBounds.x + touchBounds.width * progress, y: touchBounds.y + touchBounds.height / 2 }];
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: finger(0.85) });
    for (const progress of [0.7, 0.5, 0.3, 0.1]) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: finger(progress) });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await carousel.getByText('1 / 2', { exact: true }).waitFor();
    const priorTouchScroll = await viewport.evaluate(el => el.scrollTop);
    const verticalSign = priorTouchScroll > 10 ? 1 : -1;
    const verticalPoint = fraction => [{ x: touchBounds.x + touchBounds.width / 2,
      y: touchBounds.y + touchBounds.height * (0.5 + verticalSign * fraction) }];
    await touch.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:verticalPoint(0)});
    for (const fraction of [0.07, 0.15, 0.23, 0.31]) {
      await touch.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:verticalPoint(fraction)});
    }
    await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    await page.waitForFunction(({ viewport, priorTouchScroll }) =>
      Math.abs(viewport.scrollTop - priorTouchScroll) > 5, { viewport, priorTouchScroll });
    await carousel.getByText('1 / 2', {exact:true}).waitFor();
    await carousel.scrollIntoViewIfNeeded();
    const tapBounds = await carousel.boundingBox();
    await touch.send('Input.dispatchTouchEvent', {type:'touchStart',
      touchPoints:[{x:tapBounds.x + tapBounds.width / 2, y:tapBounds.y + tapBounds.height / 2}]});
    await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
    await page.waitForURL(/#\/notes\/[^/]+$/);
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await touch.detach();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseURL + '/#/notes');
    const file = baseURL + '/' + manifest['ui/business/NoteCardPreview.tsx'].file;
    await page.route(file, request => request.abort());
    await page.reload({ waitUntil: 'domcontentloaded' });
    const retry = page.locator('.ui-note-card').filter({ has: page.getByRole('button', { name: '打开 Property cover', exact: true }) }).getByRole('button', { name: '重试加载笔记卡片预览', exact: true });
    await retry.waitFor();
    await page.unroute(file);
    await retry.click({ timeout: 3000 });
    assert.deepEqual(await color(preview('Property cover')), [0, 255, 0, 255]);
    await preview('Property cover').getByRole('button', {name:'打开笔记 · 笔记封面', exact:true}).filter({has:page.locator('[data-image-state="loaded"]')}).click();
    const type = page.getByRole('button', {name:'编辑内容类型'});
    await type.getByText('图片', {exact:true}).waitFor();
    const editor = page.getByRole('textbox', {name:'笔记内容'});
    await editor.press('Home');
    await page.keyboard.insertText('UndoHistoryProbe');
    await type.click();
    await page.getByRole('option', {name:'选项 文字', exact:true}).click();
    const waitForOverride = value => page.waitForFunction(async expected => {
      const root = await navigator.storage.getDirectory();
      try {
        const handle = await root.getFileHandle('Property cover.md');
        const source = await (await handle.getFile()).text();
        return expected ? source.includes('"memocard:contentTypeOverride": "memocard:text"') : !source.includes('contentTypeOverride');
      } catch (error) {
        // An atomic save can invalidate this OPFS File between getFile() and text().
        if (error.name === 'NotReadableError' || error.name === 'NotFoundError') return false;
        throw error;
      }
    }, value);
    await waitForOverride(true);
    await editor.press('ControlOrMeta+z');
    await waitForOverride(false);
    assert.ok((await editor.innerText()).includes('UndoHistoryProbe'));
    await editor.press('ControlOrMeta+z');
    assert.ok(!(await editor.innerText()).includes('UndoHistoryProbe'));
    await editor.press('ControlOrMeta+Shift+z');
    await editor.press('ControlOrMeta+Shift+z');
    await waitForOverride(true);
    // Leaving through the editor flushes the note and its recovery draft before reload.
    await returnToNotes(page);
    await page.reload();
    assert.deepEqual(await color(preview('Property cover'), true), [0, 255, 0, 255]);
    await page.getByRole('button', {name:'打开 Property cover', exact:true}).locator('span').waitFor();
    await page.getByRole('button', {name:'打开 Property cover', exact:true}).click();
    await type.getByText('文字', {exact:true}).waitFor();
    await page.getByRole('button', {name:'属性菜单 内容类型'}).click();
    await page.getByRole('menuitem', {name:'恢复自动判断'}).click();
    await waitForOverride(false);
    await type.getByText('图片', {exact:true}).waitFor();
    await editor.press('ControlOrMeta+z');
    await waitForOverride(true);
    await editor.press('ControlOrMeta+Shift+z');
    await waitForOverride(false);
    await returnToNotes(page);
    assert.deepEqual(await color(preview('Property cover')), [0, 255, 0, 255]);
    await preview('Property cover').getByRole('button', {name:'打开笔记 · 笔记封面', exact:true}).filter({has:page.locator('[data-image-state="loaded"]')}).click();
    await returnToNotes(page);
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '打开 Property cover');
    assert.deepEqual(errors, []);
  } finally { gate.resolve(); await browser.close(); }
});
