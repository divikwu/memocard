// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ browser: false, web: false, loads: 0, transport: vi.fn() }));
vi.mock('./client-mode', () => ({ get isBrowserVault() { return state.browser; }, get isLocalWeb() { return state.web; } }));
vi.mock('./browser-vault', () => {
  state.loads++;
  return { browserTransport: state.transport, getBrowserVaultBinding: () => 'binding', readBrowserAsset: vi.fn() };
});
afterEach(() => { state.browser = false; state.web = false; vi.resetModules(); });

it('does not load directory storage for native or local-web clients', async () => {
  for (const web of [false, true]) {
    state.web = web;
    vi.resetModules();
    const runtime = await import('./browser-runtime');
    expect(runtime.getBrowserVaultBinding()).toBeNull();
    expect(state.loads).toBe(0);
  }
});

it('has directory transport ready before a picker click is dispatched', async () => {
  state.browser = true;
  state.transport.mockResolvedValue({ ok: true, data: { cancelled: true } });
  const { createBridge, createBrowserFileTransport } = await import('./bridge');
  const pending = createBridge(createBrowserFileTransport())('selectVault');
  expect(state.transport).toHaveBeenCalledWith(expect.objectContaining({ operation: 'selectVault' }));
  await expect(pending).resolves.toEqual({ cancelled: true });
});
