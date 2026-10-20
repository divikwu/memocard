// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TagPreferenceState } from '@memocard/contracts';
import { connectSharedTagPreferences, sharedTagPreferences, tagPreferenceKey, updateSharedTagPreferences } from './shared-tag-preferences';
const bridge = vi.hoisted(() => ({request:vi.fn()}));
vi.mock('./bridge', () => ({request:bridge.request}));
let stop: (() => void) | undefined;
let remote: TagPreferenceState;
beforeEach(() => {
  localStorage.clear(); bridge.request.mockReset();
  remote = {pinned:[],icons:{},contentHash:'empty',initialized:false};
  bridge.request.mockImplementation(async (operation, params) => {
    if (operation === 'getTagPreferences') return structuredClone(remote);
    if (params.baseHash !== remote.contentHash) throw Object.assign(new Error('conflict'),{code:'HASH_CONFLICT'});
    remote = {pinned:params.pinned,icons:params.icons,contentHash:`${remote.contentHash}+`,initialized:true};
    return structuredClone(remote);
  });
});
afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); });
async function connect(vaultId = 'vault') {
  stop = connectSharedTagPreferences(vaultId);
  await sharedTagPreferences(vaultId)!.ready;
}
it('migrates existing browser pins and full emoji sequences into an uninitialized vault', async () => {
  localStorage.setItem(tagPreferenceKey('vault'),JSON.stringify({pinned:['Area/Coffee'],icons:{'Area/Coffee':'☕','area/ai':'🧑🏽‍💻'}}));
  await connect();
  expect(remote).toMatchObject({pinned:['area/coffee'],icons:{'area/coffee':'☕','area/ai':'🧑🏽‍💻'},initialized:true});
  expect(sharedTagPreferences('vault')?.error).toBe('');
});
it('loads the same saved preferences in a second browser without legacy storage', async () => {
  remote = {pinned:['area/coffee'],icons:{'area/coffee':'☕'},contentHash:'shared',initialized:true};
  await connect();
  expect(JSON.parse(sharedTagPreferences('vault')!.raw!)).toEqual({pinned:remote.pinned,icons:remote.icons});
  expect(bridge.request).toHaveBeenCalledTimes(1);
});
it('honors shared empty settings instead of resurrecting stale browser pins or icons', async () => {
  remote.initialized = true;
  localStorage.setItem(tagPreferenceKey('vault'),JSON.stringify({pinned:['old'],icons:{old:'☕'}}));
  await connect();
  expect(remote.pinned).toEqual([]);
  expect(JSON.parse(localStorage.getItem(tagPreferenceKey('vault'))!)).toEqual({pinned:[],icons:{}});
  expect(bridge.request).toHaveBeenCalledTimes(1);
});
it('reapplies only the intended change after a conflict, preserving another client’s changes', async () => {
  await connect();
  const original = bridge.request.getMockImplementation()!;
  let conflict = true;
  bridge.request.mockImplementation(async (operation,params) => {
    if (operation === 'setTagPreferences' && conflict) {
      conflict = false; remote = {pinned:['other'],icons:{other:'🎨'},contentHash:'other-client',initialized:true};
      throw Object.assign(new Error('conflict'),{code:'HASH_CONFLICT'});
    }
    return original(operation,params);
  });
  await updateSharedTagPreferences('vault', current => ({...current,pinned:[...current.pinned,'area/coffee']}));
  expect(remote.pinned).toEqual(['other','area/coffee']);
  expect(remote.icons).toEqual({other:'🎨'});
});
it('does not publish a late reply after leaving the vault', async () => {
  let resolve!: (value: TagPreferenceState) => void;
  bridge.request.mockImplementation(() => new Promise<TagPreferenceState>(done => {resolve=done;}));
  stop = connectSharedTagPreferences('late');
  const ready = sharedTagPreferences('late')!.ready;
  stop();
  resolve({pinned:['wrong'],icons:{},contentHash:'late',initialized:true});
  await ready;
  expect(localStorage.getItem(tagPreferenceKey('late'))).toBeNull();
});
it('reads shared settings even if the browser cache is corrupt', async () => {
  localStorage.setItem(tagPreferenceKey('vault'),'{broken');
  remote = {pinned:['shared'],icons:{shared:'☕'},contentHash:'shared',initialized:true};
  await connect();
  expect(sharedTagPreferences('vault')?.error).toBe('');
  expect(JSON.parse(sharedTagPreferences('vault')!.raw!).pinned).toEqual(['shared']);
});
it('retries legacy migration after a transient initial read failure without clearing the cache', async () => {
  localStorage.setItem(tagPreferenceKey('vault'),JSON.stringify({pinned:['work'],icons:{work:'☕'}}));
  bridge.request.mockRejectedValueOnce(new Error('连接中断'));
  await connect();
  expect(sharedTagPreferences('vault')?.error).toBe('连接中断');
  await expect(updateSharedTagPreferences('vault',current=>({...current,pinned:['new']}))).rejects.toThrow('连接中断');
  expect(JSON.parse(localStorage.getItem(tagPreferenceKey('vault'))!).pinned).toEqual(['work']);
  window.dispatchEvent(new Event('focus'));
  await vi.waitFor(() => expect(remote.pinned).toEqual(['work']));
  expect(remote.icons).toEqual({work:'☕'});
  expect(sharedTagPreferences('vault')?.error).toBe('');
});
it('keeps the last shared state visible and reports a failed write', async () => {
  await connect();
  const original = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation,params) => operation === 'setTagPreferences' ? Promise.reject(new Error('只读文件夹')) : original(operation,params));
  await expect(updateSharedTagPreferences('vault',current=>({...current,pinned:['new']}))).rejects.toThrow('只读文件夹');
  expect(JSON.parse(sharedTagPreferences('vault')!.raw!).pinned).toEqual([]);
  expect(sharedTagPreferences('vault')?.error).toBe('只读文件夹');
});
