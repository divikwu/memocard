// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const bridge=vi.hoisted(()=>{window.__memocardNativeChrome=true;return {request:vi.fn()};});
vi.mock("./bridge",()=>({request:bridge.request,errorMessage:(e:unknown)=>e instanceof Error ? e.message : "失败"}));
vi.mock("../ui/business/NoteMarkdown",()=>({NoteMarkdown:({body,notePath}:{body:string;notePath:string})=><div data-testid="rich-trash-preview" data-path={notePath}>{body}</div>}));
import { useIOSSurface, type NativeSurface } from "./ios-native";
import { QuickCapture } from "../ui/business/QuickCapture";
import { NoteDeleteDialog } from "../ui/business/NoteDeleteDialog";
import { NoteSearchDialog } from "../ui/business/NoteSearchDialog";
import { readQuickCaptureDraft } from "./quick-capture-draft";
import { TrashPage } from "../ui/business/TrashPage";

type Published=NativeSurface & {id:string;instance:string;remove?:boolean};
const surface=(id:string):Published=>bridge.request.mock.calls.filter(([op,p])=>op === "updateNativeSurface" && p.id === id && !p.remove).at(-1)![1];
function send(id:string,action:string,value?:string,instance=surface(id).instance){act(()=>window.dispatchEvent(new CustomEvent("memocard:native-action",{detail:{surface:id,instance,action,value}})));}
beforeEach(()=>{
  localStorage.clear();bridge.request.mockReset();bridge.request.mockResolvedValue({});
  vi.stubGlobal("ResizeObserver",class{observe(){} unobserve(){} disconnect(){}});
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it("publishes only changed state and rejects actions from an unmounted surface",()=>{
  const callback=vi.fn();
  function Panel({title}:{title:string}){useIOSSurface("panel",{kind:"list",title},callback);return null;}
  const page=render(<Panel title="导航"/>),first=surface("panel");
  page.rerender(<Panel title="导航"/>);
  expect(bridge.request).toHaveBeenCalledTimes(1);
  page.rerender(<Panel title="搜索"/>);
  expect(bridge.request).toHaveBeenCalledTimes(2);
  send("panel","open");expect(callback).toHaveBeenCalledOnce();
  page.unmount();render(<Panel title="新会话"/>);
  send("panel","open",undefined,first.instance);expect(callback).toHaveBeenCalledOnce();
  send("panel","open");expect(callback).toHaveBeenCalledTimes(2);
});

it("does not send hidden panel data or repeat bridge updates while it changes",()=>{
  function Panel({text,open}:{text:string;open:boolean}){useIOSSurface("hidden",{kind:"form",title:"草稿",presented:open,sections:[{id:"body",fields:[{id:"text",title:"正文",value:text}]}]},()=>{});return null;}
  const page=render(<Panel text="第一版" open={false}/>);
  expect(surface("hidden").sections).toBeUndefined();
  page.rerender(<Panel text="第二版" open={false}/>);
  expect(bridge.request).toHaveBeenCalledTimes(1);
  page.rerender(<Panel text="第二版" open/>);
  expect(bridge.request).toHaveBeenCalledTimes(2);
  expect(surface("hidden").sections?.[0].fields?.[0].value).toBe("第二版");
});

const captureProps={vaultId:"ios-test-vault",vaultBinding:"binding",rootNotes:true,tags:["设计"],disabled:false,canImage:true,handle:{current:null},docked:true};
it("retains the rich trash preview and original attachment path on iOS, restoring the reviewed revision",async()=>{
  const item={trashKey:"archive",id:"note",title:"已删除笔记",relativePath:"notes/old.md",contentHash:"listed",deletedAt:new Date().toISOString()};
  const note={id:item.id,title:item.title,relativePath:item.relativePath,contentHash:"reviewed",body:"**排版**\n\n![图片](../assets/photo.png)"};
  let removed=false;
  bridge.request.mockImplementation(async(op:string)=>{
    if(op === "getTrash")return {notes:removed ? [] : [item],issues:[]};
    if(op === "getTrashedNote")return {trashKey:item.trashKey,note};
    if(op === "restoreNote"){removed=true;return note;}
    return {};
  });
  const onRestored=vi.fn();
  render(<TrashPage vaultId="qa" vaultBinding="binding" refreshVersion={0} onRestored={onRestored}/>);
  fireEvent.click(await screen.findByRole("button",{name:"查看已删除笔记：已删除笔记"}));
  const dialog=await screen.findByRole("dialog",{name:item.title});
  expect((await within(dialog).findByTestId("rich-trash-preview")).getAttribute("data-path")).toBe(item.relativePath);
  expect(within(dialog).getByTestId("rich-trash-preview").textContent).toBe(note.body);
  expect(bridge.request.mock.calls.some(([op,p])=>op === "updateNativeSurface" && p.id === "trash-preview")).toBe(false);
  fireEvent.click(within(dialog).getByRole("button",{name:"恢复笔记"}));
  await waitFor(()=>expect(onRestored).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith("restoreNote",{trashKey:item.trashKey,baseHash:"reviewed",vaultId:"qa",vaultBinding:"binding"});
});
it("protects native capture text, tags and attachments across dismissal and retries",async()=>{
  const onRecorded=vi.fn();let fail=true;
  bridge.request.mockImplementation(async(op:string,p:Record<string,unknown>)=>{
    if(op === "saveNote"){if(fail)throw new Error("磁盘只读");return {id:p.id,body:p.body,tags:p.inheritedTags};}
    if(op === "pickImage")return {relativePath:"assets/one.png",markdownPath:"assets/one.png"};
    return {};
  });
  const props={...captureProps,onRecorded,onContinue:vi.fn()};
  const page=render(<QuickCapture {...props}/>);
  act(()=>window.dispatchEvent(new Event("memocard:open-native-capture")));
  expect(surface("capture").kind).toBe("capture");
  send("capture","text","保留原来的快速记录");send("capture","tag:设计");send("capture","image");
  await waitFor(()=>expect(readQuickCaptureDraft(captureProps.vaultId)?.images).toHaveLength(1));
  expect(surface("capture").sections?.find(section=>section.id === "more")?.actions?.some(action=>action.id === "continue")).toBe(true);
  send("capture","close");expect(surface("capture").presented).toBe(false);
  page.unmount();render(<QuickCapture {...props}/>);
  act(()=>window.dispatchEvent(new Event("memocard:open-native-capture")));
  expect(surface("capture").sections?.[0].fields?.[0].value).toBe("保留原来的快速记录 #设计 ");
  expect(surface("capture").sections?.find(section=>section.id === "selected-tags")?.actions?.[0].title).toBe("设计");
  send("capture","record");await waitFor(()=>expect(surface("capture").error).toBe("磁盘只读"));
  expect(readQuickCaptureDraft(captureProps.vaultId)?.images).toHaveLength(1);
  fail=false;send("capture","record");
  await waitFor(()=>expect(onRecorded).toHaveBeenCalledOnce());
  expect(readQuickCaptureDraft(captureProps.vaultId)).toBeNull();
  const writes=bridge.request.mock.calls.filter(([op])=>op === "saveNote");
  expect(writes[0][1].id).toBe(writes[1][1].id);
  expect(writes[1][1]).toMatchObject({inheritedTags:[],body:"保留原来的快速记录 #设计\n\n![图片](assets/one.png)"});
});

it("keeps immediate native input and blocks duplicate submissions",async()=>{
  let finish!:(note:unknown)=>void;
  bridge.request.mockImplementation((op:string)=>op === "saveNote" ? new Promise(resolve=>{finish=resolve;}) : Promise.resolve({}));
  const onRecorded=vi.fn();render(<QuickCapture {...captureProps} onRecorded={onRecorded}/>);
  act(()=>window.dispatchEvent(new Event("memocard:open-native-capture")));
  act(()=>{send("capture","text","最后一次输入也要保存");send("capture","tag:设计");send("capture","record");send("capture","record");});
  expect(bridge.request.mock.calls.filter(([op])=>op === "saveNote")).toHaveLength(1);
  expect(bridge.request.mock.calls.find(([op])=>op === "saveNote")?.[1]).toMatchObject({body:"最后一次输入也要保存 #设计",inheritedTags:[]});
  await act(async()=>finish({id:"saved"}));expect(onRecorded).toHaveBeenCalledOnce();
});

it("removes only the native attachment while preserving immediate text and tag changes",async()=>{
  bridge.request.mockImplementation(async(op:string)=>op === "pickImage" ? {relativePath:"assets/one.png",markdownPath:"assets/one.png"} : {});
  render(<QuickCapture {...captureProps} onRecorded={vi.fn()}/>);
  act(()=>window.dispatchEvent(new Event("memocard:open-native-capture")));
  send("capture","image");
  await waitFor(()=>expect(readQuickCaptureDraft(captureProps.vaultId)?.images).toHaveLength(1));
  act(()=>{send("capture","text","移除图片时保留最后输入");send("capture","tag:设计");send("capture","remove-image:assets/one.png");});
  expect(readQuickCaptureDraft(captureProps.vaultId)).toMatchObject({text:"移除图片时保留最后输入 #设计 ",tags:["设计"],images:[]});
});

it("preserves the native search session and rejects an older query reply",async()=>{
  let oldReply!:(value:unknown)=>void;
  const coverage={complete:true,indexed:1,pending:0,issues:0,indexedAt:null};
  bridge.request.mockImplementation((op:string,p:Record<string,unknown>)=>{
    if(op !== "queryNotes")return Promise.resolve({});
    if(p.query === "旧")return new Promise(resolve=>{oldReply=resolve;});
    return Promise.resolve({notes:p.query === "新" ? [{id:"new",title:"新结果",body:"中文正文",updatedAt:new Date().toISOString()}] : [],nextCursor:null,coverage});
  });
  const onOpenNote=vi.fn(),onOpenChange=vi.fn();
  const props={open:true,onOpenChange,onOpenNote,vaultName:"测试",available:true,returnFocus:{current:null},preserveSession:true};
  const page=render(<NoteSearchDialog {...props}/>);
  expect(surface("search").kind).toBe("search");
  send("search","query","旧");await waitFor(()=>expect(oldReply).toBeTypeOf("function"));
  send("search","query","新");
  await waitFor(()=>expect(surface("search").sections?.some(section=>section.actions?.some(action=>action.id === "note:new"))).toBe(true));
  await act(async()=>oldReply({notes:[],nextCursor:null,coverage}));
  expect(surface("search").sections?.some(section=>section.actions?.some(action=>action.id === "note:new"))).toBe(true);
  send("search","note:new");expect(onOpenNote).toHaveBeenCalledWith("new");
  page.rerender(<NoteSearchDialog {...props} open={false}/>);
  expect(surface("search").presented).toBe(false);
  page.rerender(<NoteSearchDialog {...props}/>);
  expect(surface("search").sections?.[0].fields?.[0].value).toBe("新");
  expect(surface("search").sections?.some(section=>section.actions?.some(action=>action.id === "note:new"))).toBe(true);
});


it("uses native note deletion confirmation and prevents duplicate delete requests", async () => {
  let finish!: () => void;
  bridge.request.mockImplementation((op: string) => op === "deleteNote" ? new Promise<void>(resolve => { finish = resolve; }) : Promise.resolve({}));
  const onDeleted = vi.fn(), onCancel = vi.fn();
  const prepareDelete = vi.fn().mockResolvedValue({ id: "note", contentHash: "reviewed" });
  render(<NoteDeleteDialog target={{ id: "note", title: "草稿笔记", vaultId: "qa", vaultBinding: "binding" }} prepareDelete={prepareDelete} onDeleted={onDeleted} onCancel={onCancel} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(surface("delete-note").presented).toBe(true);
  act(() => { send("delete-note", "delete"); send("delete-note", "delete"); send("delete-note", "close"); });
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(prepareDelete).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
  expect(bridge.request.mock.calls.filter(([op]) => op === "deleteNote")).toHaveLength(1);
  expect(bridge.request).toHaveBeenCalledWith("deleteNote", { id: "note", baseHash: "reviewed", vaultId: "qa", vaultBinding: "binding" });
  await act(async () => finish());
  expect(onDeleted).toHaveBeenCalledOnce();
});

it("keeps permanent trash deletion in the native confirmation and retries a failed request", async () => {
  const item = { trashKey: "archive", id: "note", title: "已删除笔记", relativePath: "notes/old.md", contentHash: "listed", deletedAt: new Date().toISOString() };
  let fail = true;
  bridge.request.mockImplementation(async (op: string) => {
    if (op === "getTrash") return { notes: [item], issues: [] };
    if (op === "permanentlyDeleteNote") { if (fail) throw new Error("磁盘只读"); return {}; }
    return {};
  });
  render(<TrashPage vaultId="qa" vaultBinding="binding" refreshVersion={0} canPermanentlyDelete onRestored={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "永久删除笔记：已删除笔记" }));
  expect(surface("delete-trash").presented).toBe(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  send("delete-trash", "delete");
  await waitFor(() => expect(surface("delete-trash").error).toBe("磁盘只读"));
  fail = false; send("delete-trash", "delete");
  await waitFor(() => expect(surface("delete-trash").presented).toBe(false));
  expect(bridge.request.mock.calls.filter(([op]) => op === "permanentlyDeleteNote")).toHaveLength(2);
});
