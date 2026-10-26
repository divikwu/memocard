import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';

let buildDirectory;
let executable;
const staticFontBytes = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 0xff, 1]);
before(async () => {
  assert.equal(process.platform, 'darwin');
  buildDirectory = await mkdtemp(join(tmpdir(), 'memocard-web-network-'));
  executable = join(buildDirectory, 'LocalWebServerHarness');
  await promisify(execFile)('xcrun', ['swiftc', '-swift-version', '5', '-strict-concurrency=complete', '-warnings-as-errors',
    fileURLToPath(new URL('../../../packages/local-service/Sources/MemoCardLocalWeb/LocalWebServer.swift', import.meta.url)),
    fileURLToPath(new URL('./LocalWebServerHarness.swift', import.meta.url)), '-o', executable]);
});
after(async () => { if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true }); });

async function webHost(t) {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-web-session-'));
  const resources = join(directory, 'resources');
  await mkdir(resources);
  // Match Vite's real production output, including its escaped CSP quotes.
  await writeFile(join(resources, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head>
<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;self&#39; memocard-ui:; style-src &#39;self&#39; memocard-ui: &#39;unsafe-inline&#39;; font-src &#39;self&#39; memocard-ui:; img-src &#39;self&#39; memocard-asset:; connect-src &#39;none&#39;; object-src &#39;none&#39;; frame-src &#39;none&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
</head><body>MemoCard</body></html>`);
  await writeFile(join(resources, 'bundle.js'), 'window.memocardTest = true;');
  await mkdir(join(resources, 'assets'));
  for (const suffix of ['woff', 'woff2']) {
    await writeFile(join(resources, `assets/test-font-12345678.${suffix}`), staticFontBytes);
  }
  await writeFile(join(directory, 'private.js'), 'not public');
  await symlink(join(directory, 'private.js'), join(resources, 'escape.js'));
  await symlink(join(directory, 'private.js'), join(resources, 'assets/escape.woff2'));
  const configFile = join(directory, 'connection.json');
  const host = spawn(executable, [configFile, resources], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  host.stderr.on('data', bytes => { stderr += bytes.toString(); });
  const signal = expected => new Promise((resolve, reject) => {
    const onExit = code => { clearTimeout(timer); reject(new Error(`Test host exited: ${code}`)); };
    const timer = setTimeout(() => { host.off('exit', onExit); reject(new Error('Test host readiness timeout')); }, 5000);
    host.stdout.once('data', bytes => {
      clearTimeout(timer);
      host.off('exit', onExit);
      try { assert.equal(bytes.toString(), expected + '\n'); resolve(); } catch (error) { reject(error); }
    });
    host.once('exit', onExit);
  });
  t.after(async () => {
    if (host.exitCode === null) {
      const exited = new Promise(resolve => host.once('exit', resolve));
      host.kill('SIGTERM');
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
    assert.equal(stderr, '', 'Host must not log credentials or note contents.');
  });
  await signal('READY');
  let config = JSON.parse(await readFile(configFile, 'utf8'));
  const command = async (value, expected = value.toUpperCase()) => {
    const ready = signal(expected);
    host.stdin.write(value + '\n');
    await ready;
    config = JSON.parse(await readFile(configFile, 'utf8'));
    return config;
  };
  return { get config() { return config; }, command, resourceIndex: join(resources, 'index.html') };
}
function token(config) { return new URLSearchParams(new URL(config.launchURL).hash.split('?')[1]).get('token'); }
function envelope(params = {}, overrides = {}) { return { version: 1, requestId: randomUUID(), operation: 'getNote', params, ...overrides }; }
function requestBytes(config, { method = 'POST', path = '/api/bridge', body = envelope(), headers = {} } = {}) {
  const bytes = body === null ? Buffer.alloc(0) : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const origin = new URL(config.baseURL).origin;
  const fields = { Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json', 'Content-Length': bytes.length, ...headers };
  const head = `${method} ${path} HTTP/1.1\r\n` + Object.entries(fields).filter(([, value]) => value !== null).map(([name, value]) => `${name}: ${value}\r\n`).join('') + '\r\n';
  return Buffer.concat([Buffer.from(head), bytes]);
}
function exchange(config, pieces, { timeoutMs = 10000, halfClose = false } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.baseURL);
    const socket = createConnection({ host: url.hostname, port: Number(url.port), family: 4 });
    const timer = setTimeout(() => finish(new Error('HTTP reply timeout')), timeoutMs);
    let buffer = Buffer.alloc(0);
    let done = false;
    function finish(error) {
      if (done) return;
      done = true; clearTimeout(timer); socket.destroy();
      if (error) { reject(error); return; }
      const split = buffer.indexOf('\r\n\r\n');
      if (split < 0) { resolve(null); return; }
      const lines = buffer.subarray(0, split).toString().split('\r\n');
      const headers = Object.fromEntries(lines.slice(1).map(line => [line.split(':')[0].toLowerCase(), line.slice(line.indexOf(':') + 1).trim()]));
      resolve({ status: Number(lines[0].split(' ')[1]), headers, body: buffer.subarray(split + 4) });
    }
    socket.on('data', bytes => { buffer = Buffer.concat([buffer, bytes]); });
    socket.on('error', error => error.code === 'ECONNRESET' ? finish() : finish(error));
    socket.on('close', () => finish());
    socket.once('connect', async () => {
      for (const piece of pieces) {
        if (done) return;
        socket.write(piece);
        if (pieces.length > 1) await new Promise(resolve => setTimeout(resolve, 5));
      }
      if (halfClose) socket.end();
    });
  });
}
async function call(config, options) { return exchange(config, [requestBytes(config, options)]); }
async function authenticate(host) {
  const reply = await call(host.config, { path: '/api/session', body: { token: token(host.config) } });
  assert.equal(reply.status, 200);
  assert.match(reply.headers['set-cookie'], /; Path=\/; HttpOnly; SameSite=Strict$/);
  return reply.headers['set-cookie'].split(';')[0];
}

test('serves production files with Web marker, matching CSP and no fallback or symlink escape', async t => {
  const host = await webHost(t);
  assert.equal(new URL(host.config.baseURL).hostname, '127.0.0.1');
  const index = await call(host.config, { method: 'GET', path: '/', body: null });
  assert.equal(index.status, 200);
  assert.match(index.body.toString(), /<meta name="memocard-local-web" content="1">/);
  assert.doesNotMatch(index.body.toString(), /http-equiv="Content-Security-Policy"/i);
  assert.doesNotMatch(index.body.toString(), /memocard-(ui|asset):/);
  assert.match(index.body.toString(), /<meta charset="UTF-8">/);
  assert.match(index.headers['content-security-policy'], /connect-src 'self'/);
  assert.match(await readFile(host.resourceIndex, 'utf8'), /connect-src &#39;none&#39;/, 'Native bundle must retain its original CSP.');
  assert.match(index.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(index.headers['x-content-type-options'], 'nosniff');
  assert.equal(index.headers['cache-control'], 'no-store, private');
  assert.equal((await call(host.config, { method: 'GET', path: '/bundle.js', body: null })).status, 200);
  for (const path of ['/missing.js', '/notes', '/escape.js', '/index.html/other', '/%252e%252e/private.js']) {
    assert.equal((await call(host.config, { method: 'GET', path, body: null })).status, 404);
  }
  for (const path of ['/../private.js', '/%2e%2e/private.js', '//bundle.js']) {
    assert.equal((await call(host.config, { method: 'GET', path, body: null })).status, 400);
  }
});

test('static font retry cachebusters preserve the original HTTP bytes and headers', async t => {
  const host = await webHost(t);
  for (const suffix of ['woff', 'woff2']) {
    const path = `/assets/test-font-12345678.${suffix}`;
    const original = await call(host.config, { method: 'GET', path, body: null });
    assert.equal(original.status, 200);
    assert.equal(original.headers['content-type'], `font/${suffix}`);
    assert.deepEqual(original.body, staticFontBytes);
    for (const attempt of ['1', '2']) {
      const retry = await call(host.config, { method: 'GET', path: `${path}?font-retry=${attempt}`, body: null });
      assert.equal(retry.status, 200);
      assert.deepEqual(retry.body, original.body);
      assert.deepEqual(retry.headers, original.headers);
    }
  }
  assert.equal((await call(host.config, { method: 'GET', path: '/assets/escape.woff2?font-retry=1', body: null })).status, 404);
});

test('font retry exception rejects other queries, routes, methods and malformed counters', async t => {
  const host = await webHost(t);
  const cookie = await authenticate(host);
  const font = '/assets/test-font-12345678.woff2';
  for (const query of ['', 'other=1', 'font-retry', 'font-retry=', 'font-retry=0', 'font-retry=-1', 'font-retry=+1',
    'font-retry=01', 'font-retry=1.5', 'font-retry=1e3', 'font-retry=9223372036854775808', 'font-retry=%31',
    '%66ont-retry=1', 'font-retry=1&other=1', 'other=1&font-retry=1', 'font-retry=1&font-retry=2', 'font-retry=1&', 'font-retry=1%26other=1']) {
    assert.equal((await call(host.config, { method: 'GET', path: `${font}?${query}`, body: null })).status, 400, query);
  }
  for (const path of ['/', '/index.html', '/bundle.js', '/assets/theme.css', '/assets/image.png', '/test-font.woff2', '/api/session', '/api/bridge', '/api/assets/assets/image.woff2']) {
    assert.equal((await call(host.config, { method: 'GET', path: `${path}?font-retry=1`, body: null, headers: { Cookie: cookie } })).status, 400, path);
  }
  for (const path of ['/assets/../test-font-12345678.woff2', '/assets/%2e%2e/test-font-12345678.woff2', '/assets/%2ftest-font-12345678.woff2']) {
    assert.equal((await call(host.config, { method: 'GET', path: `${path}?font-retry=1`, body: null })).status, 400, path);
  }
  assert.equal((await call(host.config, { method: 'GET', path: `${font}?font-retry=1#fragment`, body: null })).status, 400);
  assert.equal((await call(host.config, { method: 'GET', path: `${font}?font-retry=1`, body: null, headers: { Host: 'evil.example' } })).status, 403);
  assert.equal((await call(host.config, { path: `${font}?font-retry=1` })).status, 400);
  assert.equal((await call(host.config, { path: `${font}?font-retry=1`, headers: { Origin: 'http://evil.example' } })).status, 403);
});

test('authenticates one-use launch token and cookies before any bridge or asset dispatch', async t => {
  const host = await webHost(t);
  assert.equal((await call(host.config)).status, 401);
  assert.equal((await call(host.config, { method: 'GET', path: '/api/assets/assets/image.png', body: null })).status, 401);
  assert.equal((await call(host.config, { path: '/api/session', body: { token: 'invalid' } })).status, 401);
  const cookie = await authenticate(host);
  assert.equal((await call(host.config, { path: '/api/session', body: { token: token(host.config) } })).status, 401);
  const message = envelope({ echo: '中文 note' });
  const reply = await call(host.config, { headers: { Cookie: cookie }, body: message });
  assert.deepEqual(JSON.parse(reply.body), { ok: true, requestId: message.requestId, data: { operation: 'getNote', echo: '中文 note', count: 1 } });
  const image = await call(host.config, { method: 'GET', path: '/api/assets/assets/image.png', body: null, headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal(image.status, 200);
  assert.equal(image.headers['content-type'], 'image/png');
  assert.deepEqual(image.body, Buffer.from([137, 80, 78, 71]));
  assert.equal((await call(host.config, { method: 'GET', path: '/api/assets/assets/photo%25test.png', body: null, headers: { Cookie: cookie } })).status, 200);
  for (const path of ['/api/assets/assets/file.svg', '/api/assets/notes/note.md']) {
    assert.equal((await call(host.config, { method: 'GET', path, body: null, headers: { Cookie: cookie } })).status, 404);
  }
});

test('requires authentication for draft reminder review before dispatch', async t => {
  const host = await webHost(t);
  const body = envelope({ id: randomUUID(), draftKey: randomUUID(), revision: 'reviewed-version', unscoped: true }, { operation: 'dismissDraftReminder' });
  assert.equal((await call(host.config, { body })).status, 401);
  const cookie = await authenticate(host);
  const reply = await call(host.config, { body, headers: { Cookie: cookie } });
  assert.equal(reply.status, 200);
  assert.equal(JSON.parse(reply.body).data.operation, 'dismissDraftReminder');
  assert.equal(JSON.parse(reply.body).data.count, 1, 'Unauthorized review must not reach the handler.');
});

test('authenticates pin metadata reads and writes before dispatch', async t => {
  const host = await webHost(t);
  for (const operation of ['getNotePins', 'setNotePinned', 'getTagPreferences', 'setTagPreferences']) {
    assert.equal((await call(host.config, {body:envelope({}, {operation})})).status, 401);
  }
  const cookie = await authenticate(host);
  for (const operation of ['getNotePins', 'setNotePinned', 'getTagPreferences', 'setTagPreferences']) {
    const reply = await call(host.config, {body:envelope({}, {operation}), headers:{Cookie:cookie}});
    assert.equal(reply.status, 200);
    assert.equal(JSON.parse(reply.body).data.operation, operation);
  }
});

test('requires exact Host and Origin and refuses cross-site requests and duplicate cookies', async t => {
  const host = await webHost(t);
  const cookie = await authenticate(host);
  for (const headers of [
    { Host: 'localhost:1234' }, { Host: 'evil.example' }, { Origin: 'https://evil.example' },
    { Origin: null }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' },
  ]) {
    assert.equal((await call(host.config, { headers: { Cookie: cookie, ...headers } })).status, 403);
  }
  assert.equal((await call(host.config, { method: 'GET', path: '/api/assets/assets/image.png', body: null, headers: { Cookie: cookie, 'Sec-Fetch-Site': 'cross-site' } })).status, 401);
  assert.equal((await call(host.config, { headers: { Cookie: `${cookie}; ${cookie}` } })).status, 401);
  for (const operation of ['setMCPEnabled', 'openExternal', 'openWeb', 'stopWeb']) {
    assert.equal((await call(host.config, { body: envelope({}, { operation }), headers: { Cookie: cookie } })).status, 400);
  }
  assert.equal((await call(host.config, { body: envelope({ create: false }, { operation: 'selectVault' }), headers: { Cookie: cookie } })).status, 200);
  assert.equal((await call(host.config, { body: envelope({}, { operation: 'listVaults' }), headers: { Cookie: cookie } })).status, 200);
  assert.equal((await call(host.config, { body: envelope({ vaultId: 'vault-2' }, { operation: 'activateVault' }), headers: { Cookie: cookie } })).status, 200);
  assert.equal((await call(host.config, { headers: { Cookie: cookie } })).status, 200);
});

test('buffers fragmented UTF-8 request headers and body including an EOF after complete JSON', async t => {
  const host = await webHost(t);
  const cookie = await authenticate(host);
  const message = envelope({ echo: '中文 🌱 notes' }, { operation: 'saveNote' });
  const bytes = requestBytes(host.config, { headers: { Cookie: cookie }, body: message });
  const split = bytes.indexOf(Buffer.from('中')) + 1;
  const reply = await exchange(host.config, [bytes.subarray(0, 15), bytes.subarray(15, split), bytes.subarray(split)], { halfClose: true });
  assert.equal(reply.status, 200);
  assert.equal(JSON.parse(reply.body).data.echo, '中文 🌱 notes');
  assert.equal(JSON.parse(reply.body).requestId, message.requestId);
});

test('rejects malformed framing, header duplication, request smuggling and oversized bodies', async t => {
  const host = await webHost(t);
  const cookie = await authenticate(host);
  const valid = requestBytes(host.config, { headers: { Cookie: cookie } });
  const malformed = [
    valid.toString().replace('Content-Length:', 'Transfer-Encoding: chunked\r\nContent-Length:'),
    valid.toString().replace('Host:', 'Host: evil.example\r\nHost:'),
    valid.toString().replace('Content-Length:', 'Content-Length: 1\r\nContent-Length:'),
    valid.toString().replace(/Content-Length: \d+/, 'Content-Length: -1'),
    valid.toString().replace(/Content-Length: \d+/, 'Content-Length: 1.5'),
    valid.toString().replace('Origin:', ' Origin:'),
    valid.toString() + 'GET / HTTP/1.1\r\n\r\n',
  ];
  for (const bytes of malformed) assert.equal((await exchange(host.config, [Buffer.from(bytes)])).status, 400);
  const enormous = valid.toString().replace(/Content-Length: \d+/, `Content-Length: ${32 * 1024 * 1024 + 1}`);
  assert.equal((await exchange(host.config, [Buffer.from(enormous)])).status, 413);
  assert.equal((await exchange(host.config, [valid.subarray(0, valid.length - 1)], { halfClose: true })).status, 400);
  const header = Buffer.from(`GET / HTTP/1.1\r\nX-Padding: ${'x'.repeat(17000)}`);
  assert.equal((await exchange(host.config, [header])).status, 431);
});

test('accepts attachment-sized request at 32 MiB body limit without corrupting framing', async t => {
  const host = await webHost(t);
  const cookie = await authenticate(host);
  const message = envelope({ padding: '', echo: 'large attachment' }, { operation: 'importAttachment' });
  message.params.padding = 'x'.repeat(32 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(message)));
  const reply = await call(host.config, { body: message, headers: { Cookie: cookie } });
  assert.equal(reply.status, 200);
  assert.equal(JSON.parse(reply.body).data.echo, 'large attachment');
});

test('new launch supersedes unused links and stop closes clients and invalidates sessions on restart', async t => {
  const host = await webHost(t);
  const oldLaunch = token(host.config);
  await host.command('launch');
  assert.equal((await call(host.config, { path: '/api/session', body: { token: oldLaunch } })).status, 401);
  const cookie = await authenticate(host);
  const oldConfig = host.config;
  const partial = createConnection({ host: '127.0.0.1', port: Number(new URL(oldConfig.baseURL).port) });
  await new Promise(resolve => partial.once('connect', resolve));
  const closed = new Promise(resolve => partial.once('close', resolve));
  partial.on('error', error => assert.equal(error.code, 'ECONNRESET'));
  partial.write('POST /api/bridge HTTP/1.1\r\n');
  await host.command('stop', 'STOPPED');
  await closed;
  await assert.rejects(call(oldConfig), { code: 'ECONNREFUSED' });
  await host.command('restart', 'RESTARTED');
  assert.equal((await call(host.config, { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await call(host.config, { path: '/api/session', body: { token: token(oldConfig) } })).status, 401);
  const newCookie = await authenticate(host);
  assert.equal((await call(host.config, { headers: { Cookie: newCookie } })).status, 200);
});


test('reopening from the same browser reuses its session instead of exhausting authorization slots', async t => {
  const host = await webHost(t);
  const cookie = await authenticate(host);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await host.command('launch');
    const reply = await call(host.config, { path: '/api/session', body: { token: token(host.config) }, headers: { Cookie: cookie } });
    assert.equal(reply.status, 200);
    assert.equal(reply.headers['set-cookie'].split(';')[0], cookie);
  }
  assert.equal((await call(host.config, { headers: { Cookie: cookie } })).status, 200);
});

test('rotates browser authorization without changing the listener origin', async t => {
  const host = await webHost(t);
  const oldOrigin = new URL(host.config.baseURL).origin;
  const oldCookie = await authenticate(host);
  await host.command('rotate');
  assert.equal(new URL(host.config.baseURL).origin, oldOrigin);
  assert.equal((await call(host.config, { headers: { Cookie: oldCookie } })).status, 401);
  const newCookie = await authenticate(host);
  assert.equal((await call(host.config, { headers: { Cookie: newCookie } })).status, 200);
});


test('authenticates draft deletion before dispatch', async t => {
  const host = await webHost(t);
  const body = envelope({id:randomUUID(), draftKey:randomUUID(), revision:'reviewed-version'}, {operation:'deleteDraft'});
  assert.equal((await call(host.config, {body})).status, 401);
  const cookie = await authenticate(host);
  const reply = await call(host.config, {body, headers:{Cookie:cookie}});
  assert.equal(reply.status, 200);
  assert.equal(JSON.parse(reply.body).data.operation, 'deleteDraft');
  assert.equal(JSON.parse(reply.body).data.count, 1);
});


test('authenticates note deletion before dispatch', async t => {
  const host=await webHost(t);
  const body=envelope({id:randomUUID(),baseHash:'reviewed-source'}, {operation:'deleteNote'});
  assert.equal((await call(host.config,{body})).status,401);
  const cookie=await authenticate(host);
  const reply=await call(host.config,{body,headers:{Cookie:cookie}});
  assert.equal(reply.status,200);
  assert.equal(JSON.parse(reply.body).data.operation,'deleteNote');
  assert.equal(JSON.parse(reply.body).data.count,1);
});


test('authenticates recycle-bin reads and restores before dispatch', async t => {
  const host=await webHost(t);
  const cookie=await authenticate(host);
  for (const operation of ['getTrash','getTrashedNote','restoreNote','permanentlyDeleteNote']) {
    const body=envelope({trashKey:randomUUID()+'/Old.md',baseHash:'reviewed-source'}, {operation});
    assert.equal((await call(host.config,{body})).status,401);
    const reply=await call(host.config,{body,headers:{Cookie:cookie}});
    assert.equal(reply.status,200);assert.equal(JSON.parse(reply.body).data.operation,operation);
  }
});
