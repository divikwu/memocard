// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PropertyLayout, PropertyLayoutPreferences } from '@memocard/contracts';
import { propertyLayoutEvent, usePropertyLayout } from './use-property-layout';

const bridge = vi.hoisted(() => ({request:vi.fn()}));
vi.mock('./bridge', () => ({request:bridge.request}));
const hash = (value:number) => value.toString(16).padStart(64,'0');
const layout = (version = 0, preferences:PropertyLayoutPreferences = {order:[],visibility:{}}):PropertyLayout => ({...preferences,contentHash:hash(version)});
const status = (vaultId = 'vault-a', capabilities = ['getPropertyLayout','setPropertyLayout']) => ({vaultId,vaultBinding:'binding-a',capabilities});
function deferred<T>() {
  let resolve!:(value:T)=>void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise,resolve};
}
function connect(initial = layout(), capabilities?:string[]) {
  let saved = initial, version = 0;
  bridge.request.mockImplementation(async (operation,params) => {
    if (operation === 'getStatus') return status('vault-a',capabilities);
    if (operation === 'getPropertyLayout') return saved;
    if (operation === 'setPropertyLayout') return saved = layout(++version,{order:params.order,visibility:params.visibility});
    throw new Error('Unexpected operation: ' + operation);
  });
  return {get saved() { return saved; }, set saved(value:PropertyLayout) { saved = value; }};
}
const calls = (operation:string) => bridge.request.mock.calls.filter(([name]) => name === operation);
beforeEach(() => { bridge.request.mockReset(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('does not access the bridge when property reads are unavailable', async () => {
  const {result} = renderHook(() => usePropertyLayout('offline',false));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.layout).toEqual({order:[],visibility:{},contentHash:''});
  expect(result.current.writable).toBe(false);
  expect(result.current.error).toBe('');
  expect(bridge.request).not.toHaveBeenCalled();
});

it.each([undefined,null,{},status('legacy',['getNote'])])('supports an older connection with status %j', async legacy => {
  bridge.request.mockResolvedValue(legacy);
  const {result} = renderHook(() => usePropertyLayout('legacy',true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.writable).toBe(false);
  expect(result.current.error).toBe('');
  expect(calls('getPropertyLayout')).toHaveLength(0);
});

it('reports real discovery failures and retries discovery', async () => {
  connect();
  bridge.request.mockRejectedValueOnce(new Error('connection failed'));
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.error).toBe('connection failed'));
  expect(result.current.ready).toBe(true);
  expect(result.current.writable).toBe(false);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.writable).toBe(true));
  expect(result.current.error).toBe('');
});

it('silently retries startup indexing after one second and then loads the layout', async () => {
  vi.useFakeTimers();
  connect();
  bridge.request.mockRejectedValueOnce({code:'INDEXING',message:'indexing'});
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await act(async () => undefined);
  expect(result.current.ready).toBe(false);
  expect(result.current.error).toBe('');
  await act(async () => vi.advanceTimersByTimeAsync(999));
  expect(calls('getStatus')).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(calls('getStatus')).toHaveLength(2);
  expect(calls('getPropertyLayout')).toHaveLength(1);
  expect(result.current.writable).toBe(true);
  expect(result.current.error).toBe('');
});

it('keeps retrying only the known indexing condition without displaying an error', async () => {
  vi.useFakeTimers();
  bridge.request.mockRejectedValue({code:'INDEXING',message:'indexing'});
  const {result,unmount} = renderHook(() => usePropertyLayout('a',true));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(calls('getStatus')).toHaveLength(3);
  expect(result.current.ready).toBe(false);
  expect(result.current.error).toBe('');
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels a scheduled indexing retry when focus starts a fresh successful read', async () => {
  vi.useFakeTimers();
  connect();
  bridge.request.mockRejectedValueOnce({code:'INDEXING'});
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await act(async () => undefined);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(result.current.writable).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(calls('getStatus')).toHaveLength(2);
  expect(calls('getPropertyLayout')).toHaveLength(1);
});

it.each(['scope','unmount'])('cancels an indexing timer on %s cleanup', async action => {
  vi.useFakeTimers();
  bridge.request.mockRejectedValue({code:'INDEXING'});
  const {rerender,unmount} = renderHook(({scope,canRead}) => usePropertyLayout(scope,canRead),{initialProps:{scope:'a',canRead:true}});
  await act(async () => undefined);
  expect(vi.getTimerCount()).toBe(1);
  if (action === 'scope') rerender({scope:'b',canRead:false}); else unmount();
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(calls('getStatus')).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('reads supported preferences without allowing an unadvertised write', async () => {
  connect(layout(0,{order:['system:tags'],visibility:{'property:Other':'hidden'}}),['getPropertyLayout']);
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.layout.order).toEqual(['system:tags']);
  expect(result.current.writable).toBe(false);
  await expect(result.current.update(current => current)).rejects.toThrow('不支持');
  expect(calls('setPropertyLayout')).toHaveLength(0);
});

it('binds reads and writes to the discovered vault and the explicit editor binding', async () => {
  connect(layout(0,{order:['property:Other'],visibility:{'property:Other':'hidden'}}));
  const {result} = renderHook(() => usePropertyLayout('a',true,'editor-binding'));
  await waitFor(() => expect(result.current.writable).toBe(true));
  expect(calls('getPropertyLayout')[0]).toEqual(['getPropertyLayout',{vaultId:'vault-a',vaultBinding:'editor-binding'}]);
  await act(async () => result.current.update(current => ({...current,visibility:{...current.visibility,'system:tags':'hide-empty'}})));
  expect(calls('setPropertyLayout')[0]).toEqual(['setPropertyLayout',{
    vaultId:'vault-a',vaultBinding:'editor-binding',baseHash:hash(0),order:['property:Other'],visibility:{'property:Other':'hidden','system:tags':'hide-empty'},
  }]);
});

it.each([
  {...layout(),contentHash:'invalid'},
  {...layout(),order:undefined},
  {...layout(),order:['system:tags','system:tags']},
  {...layout(),visibility:{'system:tags':'surprise'}},
  {...layout(),unexpected:true},
])('rejects malformed layout responses: %j', async value => {
  bridge.request.mockImplementation(async operation => operation === 'getStatus' ? status() : value);
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.writable).toBe(false);
  expect(result.current.error).not.toBe('');
  expect(result.current.layout.contentHash).toBe('');
});

it('serializes queued changes, rebases on the prior result, and only displays confirmed state', async () => {
  const first = deferred<PropertyLayout>();
  connect();
  const normal = bridge.request.getMockImplementation()!;
  let writes = 0;
  bridge.request.mockImplementation((operation,params) => operation === 'setPropertyLayout' && writes++ === 0 ? first.promise : normal(operation,params));
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.writable).toBe(true));
  let one!:Promise<void>, two!:Promise<void>;
  act(() => {
    one = result.current.update(current => ({...current,order:['system:filename']}));
    two = result.current.update(current => ({...current,visibility:{...current.visibility,'system:tags':'hidden'}}));
  });
  await waitFor(() => expect(calls('setPropertyLayout')).toHaveLength(1));
  expect(result.current.saving).toBe(true);
  expect(result.current.layout).toEqual(layout());
  await act(async () => { first.resolve(layout(4,{order:['system:filename'],visibility:{}})); await Promise.all([one,two]); });
  expect(calls('setPropertyLayout')[1][1]).toEqual({vaultId:'vault-a',vaultBinding:'binding-a',baseHash:hash(4),order:['system:filename'],visibility:{'system:tags':'hidden'}});
  expect(result.current.layout.order).toEqual(['system:filename']);
  expect(result.current.layout.visibility).toEqual({'system:tags':'hidden'});
  expect(result.current.saving).toBe(false);
});

it('rereads a conflict and preserves preferences belonging to other notes', async () => {
  const store = connect();
  const normal = bridge.request.getMockImplementation()!;
  let writes = 0;
  bridge.request.mockImplementation((operation,params) => {
    if (operation === 'setPropertyLayout' && writes++ === 0) {
      store.saved = layout(8,{order:['property:Remote'],visibility:{'property:Remote':'hide-empty'}});
      throw Object.assign(new Error('conflict'),{code:'HASH_CONFLICT'});
    }
    return normal(operation,params);
  });
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.writable).toBe(true));
  await act(async () => result.current.update(current => ({...current,visibility:{...current.visibility,'system:tags':'hidden'}})));
  expect(calls('setPropertyLayout')).toHaveLength(2);
  expect(calls('setPropertyLayout')[1][1]).toMatchObject({baseHash:hash(8),order:['property:Remote'],visibility:{'property:Remote':'hide-empty','system:tags':'hidden'}});
  expect(result.current.error).toBe('');
});

it('bounds conflict retries and leaves the previously confirmed layout visible on failure', async () => {
  connect();
  const normal = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation,params) => {
    if (operation === 'setPropertyLayout') throw Object.assign(new Error('conflict'),{code:'HASH_CONFLICT'});
    return normal(operation,params);
  });
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.writable).toBe(true));
  await act(async () => { await expect(result.current.update(current => ({...current,order:['system:tags']}))).rejects.toThrow('conflict'); });
  expect(calls('setPropertyLayout')).toHaveLength(3);
  expect(calls('getPropertyLayout')).toHaveLength(3);
  expect(result.current.layout).toEqual(layout());
  expect(result.current.error).toBe('conflict');
  expect(result.current.saving).toBe(false);
});

it('protects the displayed state from a failed mutating callback and allows another update', async () => {
  connect();
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.writable).toBe(true));
  await act(async () => {
    await expect(result.current.update(current => { current.order.push('system:tags'); throw new Error('invalid change'); })).rejects.toThrow('invalid change');
  });
  expect(result.current.layout.order).toEqual([]);
  await act(async () => result.current.update(current => ({...current,order:['system:filename']})));
  expect(result.current.layout.order).toEqual(['system:filename']);
  expect(result.current.error).toBe('');
});

it('ignores an old scope read that finishes after the new vault has loaded', async () => {
  const old = deferred<PropertyLayout>();
  let vaultId = 'vault-a';
  bridge.request.mockImplementation(async (operation,params) => operation === 'getStatus' ? status(vaultId) : params.vaultId === 'vault-a' ? old.promise : layout(2,{order:['system:filename'],visibility:{}}));
  const {result,rerender} = renderHook(({scope}) => usePropertyLayout(scope,true),{initialProps:{scope:'a'}});
  await waitFor(() => expect(calls('getPropertyLayout')).toHaveLength(1));
  vaultId = 'vault-b';
  rerender({scope:'b'});
  await waitFor(() => expect(result.current.layout.contentHash).toBe(hash(2)));
  await act(async () => old.resolve(layout(1,{order:['system:tags'],visibility:{}})));
  expect(result.current.layout.order).toEqual(['system:filename']);
});

it('cancels queued writes on a scope change and cannot apply an old save to the new vault', async () => {
  const old = deferred<PropertyLayout>();
  let vaultId = 'vault-a';
  bridge.request.mockImplementation(async (operation) => operation === 'getStatus' ? status(vaultId) : operation === 'getPropertyLayout' ? layout(vaultId === 'vault-a' ? 0 : 5) : old.promise);
  const {result,rerender} = renderHook(({scope}) => usePropertyLayout(scope,true),{initialProps:{scope:'a'}});
  await waitFor(() => expect(result.current.writable).toBe(true));
  let one!:Promise<void>, two!:Promise<void>;
  act(() => { one = result.current.update(current => ({...current,order:['system:tags']})); two = result.current.update(current => ({...current,order:['system:filename']})); });
  await waitFor(() => expect(calls('setPropertyLayout')).toHaveLength(1));
  vaultId = 'vault-b'; rerender({scope:'b'});
  await waitFor(() => expect(result.current.layout.contentHash).toBe(hash(5)));
  await act(async () => { old.resolve(layout(1)); await expect(one).rejects.toMatchObject({code:'VAULT_CHANGED'}); await expect(two).rejects.toMatchObject({code:'VAULT_CHANGED'}); });
  expect(calls('setPropertyLayout')).toHaveLength(1);
  expect(result.current.layout.contentHash).toBe(hash(5));
  expect(result.current.error).toBe('');
  expect(result.current.saving).toBe(false);
});

it('refreshes confirmed state on focus and surfaces refresh failures without discarding the layout', async () => {
  const store = connect();
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.writable).toBe(true));
  store.saved = layout(3,{order:['system:tags'],visibility:{}});
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.layout.contentHash).toBe(hash(3)));
  bridge.request.mockRejectedValueOnce(new Error('refresh failed'));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.error).toBe('refresh failed'));
  expect(result.current.layout.order).toEqual(['system:tags']);
});

it('refreshes another instance after a same-vault save and ignores another vault event', async () => {
  connect();
  const first = renderHook(() => usePropertyLayout('a',true));
  const second = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(first.result.current.writable && second.result.current.writable).toBe(true));
  act(() => window.dispatchEvent(new CustomEvent(propertyLayoutEvent,{detail:{vaultId:'vault-b'}})));
  expect(calls('getPropertyLayout')).toHaveLength(2);
  await act(async () => first.result.current.update(current => ({...current,order:['system:filename']})));
  await waitFor(() => expect(second.result.current.layout.order).toEqual(['system:filename']));
  expect(calls('getPropertyLayout')).toHaveLength(3);
});

it('skips refreshes during a write and ignores a pre-write read arriving after the save', async () => {
  const oldRead = deferred<PropertyLayout>(), saved = deferred<PropertyLayout>();
  connect();
  const {result} = renderHook(() => usePropertyLayout('a',true));
  await waitFor(() => expect(result.current.writable).toBe(true));
  const normal = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation,params) => operation === 'getPropertyLayout' ? oldRead.promise : operation === 'setPropertyLayout' ? saved.promise : normal(operation,params));
  act(() => window.dispatchEvent(new Event('focus')));
  let writing!:Promise<void>;
  act(() => { writing = result.current.update(current => ({...current,order:['system:filename']})); });
  await waitFor(() => expect(result.current.saving).toBe(true));
  act(() => window.dispatchEvent(new Event('focus')));
  expect(calls('getPropertyLayout')).toHaveLength(2);
  await act(async () => { saved.resolve(layout(1,{order:['system:filename'],visibility:{}})); await writing; });
  await act(async () => oldRead.resolve(layout()));
  expect(result.current.layout.contentHash).toBe(hash(1));
  expect(result.current.layout.order).toEqual(['system:filename']);
});
