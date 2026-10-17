// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const bridge=vi.hoisted(()=>{window.__memocardNativeChrome=true;return {request:vi.fn()};});
vi.mock("../bridge",()=>({request:bridge.request}));
vi.mock("../features/theme/ThemeProvider",()=>({useTheme:()=>({theme:"light",radius:"lg"})}));
import { IOSAppChrome } from "./ios-app-chrome";
import type { NativeSurface } from "../ios-native";
import { TagColorProvider } from "../TagColorProvider";
import { setTagColor } from "../tag-colors";

type Published=NativeSurface & {id:string;instance:string;remove?:boolean};
const surface=(id:string):Published=>bridge.request.mock.calls.filter(([op,p])=>op === "updateNativeSurface" && p.id === id && !p.remove).at(-1)![1];
function send(id:string,action:string){act(()=>window.dispatchEvent(new CustomEvent("memocard:native-action",{detail:{surface:id,instance:surface(id).instance,action}})));}
function props():ComponentProps<typeof IOSAppChrome> {
  return {
    title:"主页",view:"home",detail:false,tag:null,quickFilter:null,
    tags:[{name:"设计",count:3},{name:"设计/界面",count:1},{name:"开发",count:2}],filterCounts:{untagged:2,images:1,links:0},
    status:{connected:true,vaultId:"qa",vaultName:"QA 笔记库",coverage:{complete:true,indexed:5,pending:0,issues:0,indexedAt:null},phase:"ready",syncState:"local",capabilities:[]},
    hasVaultIssue:false,needsPermission:false,vaultStatus:"已连接",vaults:[{vaultId:"qa",name:"QA 笔记库",active:true},{vaultId:"other",name:"其他库",active:false}],
    canCreate:true,canSearch:true,loading:false,capabilities:new Set(["selectVault","getTrash","restoreNote"]),editing:null,
    pinDisabled:false,pinned:false,pinWorking:false,showRecord:true,busy:false,error:"",recoveryOpen:false,recoveryBusy:false,recoveryError:"",drafts:[],deleteDraftOpen:false,
    editor:{current:null},openingNote:false,onNavigate:vi.fn().mockResolvedValue(undefined),onSearch:vi.fn(),onNew:vi.fn().mockResolvedValue(undefined),onRefresh:vi.fn(),onPin:vi.fn(),onDelete:vi.fn(),onChoose:vi.fn().mockResolvedValue(undefined),onActivate:vi.fn().mockResolvedValue(undefined),onRenameTag:vi.fn().mockResolvedValue(undefined),onReauthorize:vi.fn().mockResolvedValue(undefined),onRecoveryChange:vi.fn(),onRefreshDrafts:vi.fn().mockResolvedValue(undefined),onResume:vi.fn().mockResolvedValue(undefined),onDismiss:vi.fn().mockResolvedValue(undefined),onDeleteDraft:vi.fn(),onConfirmDeleteDraft:vi.fn().mockResolvedValue(undefined),onCancelDeleteDraft:vi.fn(),
  };
}
beforeEach(()=>{localStorage.clear();bridge.request.mockReset();bridge.request.mockResolvedValue({});});
afterEach(cleanup);
it("loads tag color styles without the Web sidebar and follows color and vault changes",()=>{
  const p=props();
  const page=render(<TagColorProvider vaultId="qa"><IOSAppChrome {...p}/></TagColorProvider>);
  const styles=()=>document.head.querySelector('style[data-tag-colors]')?.textContent;
  act(()=>setTagColor("qa","设计","blue"));
  expect(styles()).toContain(`[data-tag="${encodeURIComponent("设计")}"]{--tag-bg:var(--tag-blue-bg);--tag-fg:var(--tag-blue-fg)}`);
  page.rerender(<TagColorProvider vaultId="other"><IOSAppChrome {...p}/></TagColorProvider>);
  expect(styles()).toBe("");
});
it("retains tag paths, pinned order and emoji while publishing the H5 mobile navigation",()=>{
  localStorage.setItem("memocard:tags:qa",JSON.stringify({pinned:["开发","设计/界面"],icons:{开发:"💻"}}));
  render(<IOSAppChrome {...props()}/>);send("chrome","navigation");
  const nav=surface("navigation");
  expect(nav.sections?.find(s=>s.id === "pages")?.actions?.map(a=>a.id)).toEqual(["home","notes","calendar"]);
  expect(nav.sections?.find(s=>s.id === "pinned-tags")?.actions?.map(a=>a.path)).toEqual(["开发","设计/界面"]);
  expect(nav.sections?.find(s=>s.id === "tags")?.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({id:"tag:设计/界面",path:"设计/界面",title:"界面"}),expect.objectContaining({path:"开发",emoji:"💻"}),
  ]));
  expect(nav.sections?.find(s=>s.id === "tags")?.actions?.every(a=>!a.subtitle)).toBe(true);
  expect(nav.sections?.find(s=>s.id === "filters")?.actions?.map(a=>a.badge)).toEqual([2,1,0]);
  expect(nav.sections?.find(s=>s.id === "library")?.message).toBeUndefined();
});
it("dispatches nested tag and quick filter selection and closes the sidebar",async()=>{
  const p=props();render(<IOSAppChrome {...p}/>);send("chrome","navigation");send("navigation","tag:设计/界面");
  await waitFor(()=>expect(p.onNavigate).toHaveBeenCalledWith("notes","设计/界面"));
  expect(surface("navigation").presented).toBe(false);
  send("chrome","navigation");send("navigation","filter:images");
  expect(p.onNavigate).toHaveBeenCalledWith("notes",null,"images");expect(surface("navigation").presented).toBe(false);
});
it("keeps bottom search and capture, and retains new notes and drafts through the page menu",()=>{
  const p=props();render(<IOSAppChrome {...p}/>);
  expect(surface("chrome").bottom?.map(a=>a.id)).toEqual(["search","capture"]);
  send("chrome","new");expect(p.onNew).toHaveBeenCalledOnce();
  send("chrome","search");expect(p.onSearch).toHaveBeenCalledOnce();
  const capture=vi.fn();window.addEventListener("memocard:open-native-capture",capture,{once:true});
  send("chrome","capture");expect(capture).toHaveBeenCalledOnce();
  send("chrome","drafts");expect(p.onRecoveryChange).toHaveBeenCalledWith(true);
});
it("opens vault management from sidebar settings, navigates the active vault and switches other vaults",async()=>{
  const p=props();render(<IOSAppChrome {...p}/>);send("chrome","navigation");send("navigation","vault");
  expect(surface("navigation").presented).toBe(false);expect(surface("vault").presented).toBe(true);
  send("vault","close");expect(surface("navigation").presented).toBe(true);
  send("navigation","vault");send("vault","activate:qa");expect(p.onNavigate).toHaveBeenCalledWith("notes");expect(p.onActivate).not.toHaveBeenCalled();
  send("chrome","vault");send("vault","activate:other");
  await waitFor(()=>expect(p.onActivate).toHaveBeenCalledWith("other"));expect(surface("vault").presented).toBe(false);
  send("chrome","vault");send("vault","choose");expect(p.onChoose).toHaveBeenCalledOnce();
  send("chrome","vault");send("vault","settings");expect(p.onNavigate).toHaveBeenCalledWith("settings");
  send("chrome","vault");send("vault","trash");expect(p.onNavigate).toHaveBeenCalledWith("trash");
});
it("resets the sidebar identity on vault change and preserves unavailable actions and issue feedback",()=>{
  const p=props(),page=render(<IOSAppChrome {...p}/>);send("chrome","navigation");
  page.rerender(<IOSAppChrome {...p} hasVaultIssue needsPermission vaultStatus="需要重新授权" canCreate={false} canSearch={false} capabilities={new Set(["selectVault"])} status={{...p.status!,vaultId:"other",connected:false}}/>);
  const nav=surface("navigation");expect(nav.resetKey).toBe("other");
  expect(nav.sections?.find(s=>s.id === "pages")?.actions?.find(a=>a.id === "calendar")?.disabled).toBe(true);
  expect(surface("chrome").bottom?.every(a=>a.disabled)).toBe(true);
  expect(nav.sections?.find(s=>s.id === "library")?.message).toBe("需要重新授权");
  send("navigation","vault");
  const actions=surface("vault").sections?.find(s=>s.id === "actions")?.actions;
  expect(actions?.find(a=>a.id === "trash")?.disabled).toBe(true);expect(actions?.find(a=>a.id === "help")?.disabled).toBe(true);
  send("vault","reauthorize");expect(p.onReauthorize).toHaveBeenCalledOnce();
});
