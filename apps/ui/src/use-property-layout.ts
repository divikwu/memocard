import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropertyLayout, PropertyLayoutPreferences } from '@memocard/contracts';
import { request } from './bridge';
import { validatePropertyLayout } from './property-layout';

export const propertyLayoutEvent = 'memocard:property-layout';
const emptyLayout:PropertyLayout = {order:[],visibility:{},contentHash:''};
type State = {identity:string; layout:PropertyLayout; ready:boolean; writable:boolean; saving:boolean; error:string};
type Session = {
  active:boolean; identity:string; token:symbol; params?:Record<string,unknown>; canWrite:boolean;
  layout:PropertyLayout; ready:boolean; writable:boolean; error:string; pending:number; revision:number;
  reading:boolean; queue:Promise<void>; refresh:()=>Promise<void>;
};
const initial = (identity:string):State => ({identity,layout:emptyLayout,ready:false,writable:false,saving:false,error:''});
const message = (cause:unknown) => cause instanceof Error ? cause.message : '属性布局无法同步，请重试。';
function check(session:Session) {
  if (!session.active) throw Object.assign(new Error('笔记库已切换，请重新打开属性设置。'), {code:'VAULT_CHANGED'});
}
function readState(value:unknown):PropertyLayout {
  const input = value as PropertyLayout | null;
  if (!input || typeof input !== 'object' || Array.isArray(input) || !['order','visibility','contentHash'].every(key => Object.hasOwn(input,key))
    || Object.keys(input).some(key => !['order','visibility','contentHash'].includes(key)) || typeof input.contentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(input.contentHash)) throw new Error('属性布局响应无效，请重试。');
  return {...validatePropertyLayout({order:input.order,visibility:input.visibility}),contentHash:input.contentHash};
}
async function readLayout(session:Session) {
  const value = readState(await request('getPropertyLayout', session.params));
  check(session);
  return value;
}

export function usePropertyLayout(scopeKey:string, canRead:boolean, vaultBinding?:string) {
  const identity = JSON.stringify([scopeKey,canRead,vaultBinding]);
  const current = useRef<Session | null>(null);
  const [state,setState] = useState(() => initial(identity));
  const publish = useCallback((session:Session) => {
    if (!session.active || current.current !== session) return;
    const next = {identity:session.identity,layout:session.layout,ready:session.ready,writable:session.writable,saving:session.pending > 0,error:session.error};
    setState(previous => Object.keys(next).every(key => previous[key as keyof State] === next[key as keyof State]) ? previous : next);
  }, []);

  useEffect(() => {
    const session:Session = {active:true,identity,token:Symbol(),canWrite:false,layout:emptyLayout,ready:!canRead,writable:false,error:'',pending:0,revision:0,reading:false,queue:Promise.resolve(),refresh:async () => undefined};
    let retryTimer:number | undefined;
    current.current = session;
    publish(session);
    async function refresh() {
      window.clearTimeout(retryTimer); retryTimer = undefined;
      if (!session.active || !canRead || session.reading || session.pending) return;
      session.reading = true;
      const revision = session.revision;
      try {
        if (!session.params) {
          const status = await request<{vaultId?:unknown; vaultBinding?:unknown; capabilities?:unknown}>('getStatus');
          check(session);
          if (!Array.isArray(status?.capabilities) || !status.capabilities.includes('getPropertyLayout')) {
            session.ready = true; session.error = ''; return;
          }
          if (typeof status.vaultId !== 'string' || !status.vaultId) throw new Error('属性布局缺少笔记库身份，请重新连接。');
          const binding = vaultBinding ?? (typeof status.vaultBinding === 'string' ? status.vaultBinding : undefined);
          session.params = {vaultId:status.vaultId,...(binding ? {vaultBinding:binding} : {})};
          session.canWrite = status.capabilities.includes('setPropertyLayout');
        }
        const value = await readLayout(session);
        if (revision !== session.revision || session.pending) return;
        if (session.layout.contentHash !== value.contentHash) session.layout = value;
        session.ready = true; session.writable = session.canWrite; session.error = '';
      } catch (cause) {
        if (session.active && revision === session.revision) {
          if ((cause as {code?:string})?.code === 'INDEXING') {
            session.error = '';
            retryTimer = window.setTimeout(() => { void refresh(); },1000);
          } else { session.ready = true; session.error = message(cause); }
        }
      } finally { session.reading = false; publish(session); }
    }
    session.refresh = refresh;
    const focus = () => { void refresh(); };
    const changed = (event:Event) => {
      const detail = (event as CustomEvent<{vaultId?:unknown; source?:unknown}>).detail;
      if (detail?.vaultId === session.params?.vaultId && detail?.source !== session.token) void refresh();
    };
    if (canRead) {
      void refresh();
      window.addEventListener('focus',focus);
      window.addEventListener(propertyLayoutEvent,changed);
    }
    return () => {
      session.active = false;
      window.clearTimeout(retryTimer);
      window.removeEventListener('focus',focus);
      window.removeEventListener(propertyLayoutEvent,changed);
    };
  }, [identity,canRead,vaultBinding,publish]);

  const update = useCallback((change:(current:PropertyLayoutPreferences)=>PropertyLayoutPreferences):Promise<void> => {
    const session = current.current;
    if (!session || session.identity !== identity || !session.writable) return Promise.reject(new Error('当前连接不支持保存属性布局。'));
    session.pending++; session.revision++; publish(session);
    const work = session.queue.then(async () => {
      try {
        check(session);
        let base = session.layout;
        for (let attempt = 0; attempt < 3; attempt++) {
          const next = validatePropertyLayout(change({order:[...base.order],visibility:{...base.visibility}}));
          try {
            check(session);
            const saved = readState(await request('setPropertyLayout', {...next,baseHash:base.contentHash,...session.params}));
            check(session);
            session.layout = saved; session.error = ''; publish(session);
            window.dispatchEvent(new CustomEvent(propertyLayoutEvent, {detail:{vaultId:session.params?.vaultId,source:session.token}}));
            return;
          } catch (cause) {
            if ((cause as {code?:string})?.code !== 'HASH_CONFLICT' || attempt === 2) throw cause;
            base = await readLayout(session);
          }
        }
      } catch (cause) { if (session.active) session.error = message(cause); throw cause; }
      finally { session.pending--; publish(session); }
    });
    session.queue = work.catch(() => undefined);
    return work;
  }, [identity,publish]);
  const retry = useCallback(() => {
    const session = current.current;
    if (session?.identity === identity) void session.refresh();
  }, [identity]);
  const visible = state.identity === identity ? state : initial(identity);
  return {layout:visible.layout,ready:visible.ready,writable:visible.writable,saving:visible.saving,error:visible.error,update,retry};
}
