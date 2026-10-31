import { useEffect, useRef, useState, type RefObject } from "react";
import type { NoteFilterCounts, NoteQuickFilter, VaultStatus } from "@memocard/contracts";
import type { Draft, RegisteredVault } from "../../src/bridge";
import type { NoteDeleteTarget } from "../../src/hooks/use-note-delete";
import type { EditorHandle } from "../../src/editor-core";
import { useIOSSurface, type NativeAction } from "../../src/ios-native";
import { useCollectionLayout } from "../../src/hooks/use-collection-layout";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { noteFilterLabels } from "../../src/note-filter-labels";
import "./native-chrome.css";
import { useWebAppearance } from "../web/WebAppearance";
import { usePreviewAppearance } from "../preview-mode";
import { getPreviewRadius } from "../preview-appearance";
import TagColorStyles from "../business/TagColorStyles";
import { readIOSPalette } from "../../src/lib/ios-palette";
import { readIOSThemeRadius } from "../../src/lib/ios-theme";

type View = "home" | "notes" | "tags" | "settings" | "trash";
export type IOSAppChromeProps = {
  title:string; view:View; detail:boolean; tag:string|null; quickFilter:NoteQuickFilter|null;
  tags:{name:string;count:number}[]; filterCounts?:NoteFilterCounts; status:VaultStatus|null; hasVaultIssue:boolean; needsPermission:boolean;
  vaultBinding?:string; vaultStatus:string; vaults:RegisteredVault[]; canCreate:boolean; canSearch:boolean; loading:boolean;
  capabilities:ReadonlySet<string>; editing:Draft|null; pinDisabled:boolean; pinned:boolean; pinWorking:boolean;
  showRecord:boolean; busy:boolean; error:string; recoveryOpen:boolean; recoveryBusy:boolean; recoveryError:string;
  drafts:Draft[]; deleteDraftOpen:boolean;
  onNavigate:(view:View,tag?:string|null,filter?:NoteQuickFilter|null)=>Promise<void>;
  editor:RefObject<EditorHandle|null>; openingNote:boolean; onSearch:()=>void; onNew:()=>Promise<void>; onRefresh:()=>void;
  onReauthorize:()=>Promise<void>; onPin:()=>void; onDelete:(target:NoteDeleteTarget)=>void; onChoose:()=>Promise<void>; onActivate:(id:string)=>Promise<void>;
  onRenameTag:(from:string,to:string)=>Promise<void>; onRecoveryChange:(open:boolean)=>void; onRefreshDrafts:()=>Promise<void>;
  onResume:(draft:Draft)=>Promise<void>; onDismiss:(draft:Draft)=>Promise<void>; onDeleteDraft:(target:{draft:Draft;vaultId:string;vaultBinding?:string})=>void;
  onConfirmDeleteDraft:()=>Promise<void>; onCancelDeleteDraft:()=>void;
};
const draftKey = (draft:Draft) => JSON.stringify([draft.id,draft.draftKey,draft.revision,draft.recoveryScope,draft.unscoped]);

// Read resolved Web tokens once per presentation, including user-selected theme and tag colors.
function useIOSPalette() {
  const [tokens,setTokens]=useState<{palette?:Record<string,number[]>;radius?:number}>({});
  useEffect(()=>{
    const read=()=>setTokens({palette:readIOSPalette(),radius:readIOSThemeRadius()});
    read();
    const observer=new MutationObserver(read);
    const options={attributes:true,attributeFilter:['class','style','data-web-palette','data-web-neutral','data-ui-theme','data-ui-appearance']};
    observer.observe(document.documentElement,options);
    const theme=document.querySelector('.web-app.ui-theme');
    if(theme)observer.observe(theme,options);
    return()=>observer.disconnect();
  },[]);
  return tokens;
}

export function IOSAppChrome(p:IOSAppChromeProps) {
  const {palette,radius:themeRadius}=useIOSPalette();
  const { value } = useWebAppearance() ?? {};
  const { radius } = usePreviewAppearance();
  const theme = value?.theme ?? "light";
  const {vaultId,vaultName,connected}=p.status ?? {};
  const canChoose=p.capabilities.has("selectVault") && !p.busy && !p.detail;
  const canCreate=p.canCreate && !p.busy;
  const [navigationOpen,setNavigationOpen]=useState(false),[vaultOpen,setVaultOpen]=useState(false),[editingTag,setEditingTag]=useState<string|null>(null);
  const vaultFromNavigation=useRef(false);
  const [homeLayout,changeHomeLayout]=useCollectionLayout("memocard:home-layout","list");
  const [noteLayout,changeNoteLayout]=useCollectionLayout();
  const {preferences,error:tagError,togglePinned,saveAppearance}=useTagPreferences(vaultId);
  const layout=p.view === "home" ? homeLayout : noteLayout;
  const titleMenu:NativeAction[]=[
    {id:"cards",title:"卡片",icon:"square.grid.2x2",selected:layout === "cards"},
    {id:"list",title:"列表",icon:"list.bullet",selected:layout === "list"},
    ...(p.tag && p.view === "notes" ? [{id:"pin-tag",title:preferences.pinned.includes(p.tag) ? "取消置顶标签" : "置顶标签",icon:"pin"},{id:"edit-tag",title:"编辑名称／图标",icon:"pencil",disabled:!canCreate}] : []),
  ];
  useIOSSurface("chrome", {
    kind:"chrome",title:p.detail ? "笔记" : p.title,theme,palette,
    leading:{id:p.detail ? "back" : "navigation",title:p.detail ? "返回" : "导航",icon:p.detail ? "chevron.left" : "sidebar.left"},
    pin:p.editing && p.capabilities.has("setNotePinned") ? {id:"pin",title:p.pinned ? "取消固定" : "固定到主页",icon:p.pinned ? "pin.fill" : "pin",disabled:p.pinDisabled} : undefined,
    titleMenu:!p.detail && (p.view === "home" || p.view === "notes") ? titleMenu : undefined,
    menu:[
      {id:"new",title:"新建笔记",icon:"square.and.pencil",disabled:!canCreate},
      {id:"refresh",title:"刷新笔记库",icon:"arrow.clockwise",disabled:p.loading || p.busy},
      {id:"vault",title:"笔记库",icon:"folder",disabled:!canChoose},
      {id:"drafts",title:`草稿（${p.drafts.length}）`,icon:"doc.badge.clock",disabled:!connected || p.detail},
      {id:"settings",title:"设置",icon:"gearshape"},
      ...(p.editing?.baseHash && p.capabilities.has("deleteNote") && canCreate && !p.pinWorking ? [{id:"delete",title:"删除笔记",icon:"trash",destructive:true}] : []),
    ],
    bottom:p.showRecord ? [{id:"search",title:"搜索全部笔记",icon:"magnifyingglass",disabled:!p.canSearch},{id:"capture",title:"记下此刻的想法…",icon:"plus",disabled:!canCreate}] : undefined,
  }, async action=>{
    if(action === "navigation")setNavigationOpen(true);
    if(action === "back"){if(p.openingNote)await p.onNavigate(p.view,p.tag,p.quickFilter);else await p.editor.current?.finish();}
    if(action === "new")await p.onNew();
    if(action === "refresh")p.onRefresh();
    if(action === "settings")await p.onNavigate("settings");
    if(action === "vault"){vaultFromNavigation.current=false;setVaultOpen(true);}
    if(action === "drafts")p.onRecoveryChange(true);
    if(action === "search")p.onSearch();
    if(action === "capture")window.dispatchEvent(new Event("memocard:open-native-capture"));
    if(action === "pin")p.onPin();
    if(action === "delete" && p.editing?.baseHash && vaultId)p.onDelete({id:p.editing.id,title:p.editing.title?.trim() || "新内容",vaultId:vaultId,vaultBinding:p.editing.vaultBinding ?? p.vaultBinding});
    if(action === "cards" || action === "list")(p.view === "home" ? changeHomeLayout : changeNoteLayout)(action);
    if(action === "pin-tag" && p.tag && !await togglePinned(p.tag))setNavigationOpen(true);
    if(action === "edit-tag" && p.tag)setEditingTag(p.tag);
  });
  const navigationTags=p.tags.map(item=>({id:`tag:${item.name}`,path:item.name,title:item.name.slice(item.name.lastIndexOf("/")+1),icon:"number",emoji:preferences.icons[item.name],selected:p.view === "notes" && p.tag === item.name}));
  useIOSSurface("navigation", {
    kind:"list",title:"MemoCard",presented:navigationOpen,error:tagError,resetKey:vaultId || "disconnected",
    rowRadius:themeRadius ?? Number.parseFloat(getPreviewRadius(radius).radius) * 16,
    loading:p.loading && p.tags.length === 0,
    sections:[
      {id:"pages",actions:[{id:"home",title:"主页",icon:"house",selected:p.view === "home"},{id:"notes",title:"所有笔记",icon:"note.text",selected:p.view === "notes" && !p.tag && !p.quickFilter},{id:"calendar",title:"日历",icon:"calendar",disabled:true},{id:"tags",title:"标签",icon:"number",disabled:true}]},
      {id:"filters",actions:(Object.keys(noteFilterLabels) as NoteQuickFilter[]).map(filter=>({id:`filter:${filter}`,title:noteFilterLabels[filter],icon:filter === "images" ? "photo" : filter === "links" ? "link" : "number",badge:p.filterCounts?.[filter],selected:p.view === "notes" && p.quickFilter === filter,disabled:!connected}))},
      {id:"pinned-tags",title:"置顶标签",actions:preferences.pinned.flatMap(path=>navigationTags.filter(item=>item.path === path))},
      {id:"tags",title:"标签",actions:navigationTags},
      {id:"library",message:p.hasVaultIssue ? p.vaultStatus : undefined,actions:[{id:"vault",title:vaultName || "记忆卡",icon:"square.3.layers.3d"}]},
    ],
  }, async action=>{
    setNavigationOpen(false);
    if(action === "close")return;
    if(action === "vault"){vaultFromNavigation.current=true;setVaultOpen(true);}
    else if(action.startsWith("tag:"))await p.onNavigate("notes",action.slice(4));
    else if(action.startsWith("filter:"))await p.onNavigate("notes",null,action.slice(7) as NoteQuickFilter);
    else if(["home","notes"].includes(action))await p.onNavigate(action as View);
  });
  useIOSSurface("vault", {
    kind:"list",title:"笔记库",presented:vaultOpen,busy:p.busy,error:p.error,
    sections:[{id:"vaults",actions:(p.vaults.length ? p.vaults : connected && vaultId ? [{vaultId,name:vaultName || "记忆卡",active:true}] : []).map(item=>({id:`activate:${item.vaultId}`,title:item.name,icon:"square.3.layers.3d",selected:item.active,disabled:p.busy}))},
      {id:"actions",actions:[
        ...(p.capabilities.has("selectVault") ? [{id:"choose",title:"打开已有笔记库",icon:"folder",disabled:!canChoose}] : []),
        ...(p.needsPermission ? [{id:"reauthorize",title:"重新授权文件夹",icon:"checkmark.shield",disabled:p.busy}] : []),
        {id:"settings",title:"笔记库设置",icon:"gearshape"},
        {id:"trash",title:"回收站",icon:"trash",disabled:!connected || !p.capabilities.has("getTrash") || !p.capabilities.has("restoreNote")},
        {id:"help",title:"帮助",icon:"questionmark.circle",disabled:true},
      ]}],
  }, async action=>{
    if(p.busy)return;
    setVaultOpen(false);
    const returnToNavigation=vaultFromNavigation.current;
    vaultFromNavigation.current=false;
    if(action === "close" && returnToNavigation)setNavigationOpen(true);
    if(action === "choose")await p.onChoose();
    if(action === "reauthorize")await p.onReauthorize();
    if(action === "settings" || action === "trash")await p.onNavigate(action);
    if(action.startsWith("activate:")){
      const id=action.slice(9);
      if(id === vaultId)await p.onNavigate("notes");else await p.onActivate(id);
    }
  });
  useIOSSurface("drafts", {
    kind:"list",title:"草稿",presented:p.recoveryOpen,busy:p.recoveryBusy && p.deleteDraftOpen,loading:p.recoveryBusy && !p.deleteDraftOpen,error:p.recoveryError,
    primary:{id:"refresh",title:"刷新草稿",disabled:p.recoveryBusy},
    message:p.drafts.length ? "继续编辑保留的草稿。历史草稿请先确认所属笔记库。" : "暂无草稿。",
    sections:p.drafts.map(draft=>({id:draftKey(draft),title:draft.title || draft.body.slice(0,60) || "空正文",message:draft.unscoped ? "所属库待确认" : draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : undefined,actions:[
      {id:`resume:${draftKey(draft)}`,title:"继续编辑",icon:"pencil",disabled:p.recoveryBusy},
      ...(p.capabilities.has("deleteDraft") && draft.draftKey && draft.revision ? [{id:`delete:${draftKey(draft)}`,title:"删除草稿",icon:"trash",destructive:true,disabled:p.recoveryBusy}] : []),
      ...(p.capabilities.has("dismissDraftReminder") && draft.unscoped && !draft.reminderDismissed ? [{id:`dismiss:${draftKey(draft)}`,title:"不再提醒",disabled:p.recoveryBusy}] : []),
    ]})),
  }, async action=>{
    if(action === "close")p.onRecoveryChange(false);
    if(action === "refresh")await p.onRefreshDrafts();
    const draft=p.drafts.find(item=>action.endsWith(draftKey(item)));
    if(!draft)return;
    if(action.startsWith("resume:"))await p.onResume(draft);
    if(action.startsWith("dismiss:"))await p.onDismiss(draft);
    if(action.startsWith("delete:") && vaultId)p.onDeleteDraft({draft,vaultId:vaultId,vaultBinding:draft.vaultBinding ?? p.vaultBinding});
  });
  useIOSSurface("delete-draft", {
    kind:"alert",title:"删除这条草稿？",presented:p.deleteDraftOpen && !p.recoveryBusy,message:"删除后无法恢复，已保存的笔记不受影响。",
    sections:[{id:"confirm",actions:[{id:"delete",title:"确认删除",destructive:true,disabled:p.recoveryBusy}]}],
  }, async action=>{if(action === "delete")await p.onConfirmDeleteDraft();else p.onCancelDeleteDraft();});
  return <><TagColorStyles />{editingTag && <IOSTagEditor key={editingTag} path={editingTag} icon={preferences.icons[editingTag] || ""} onClose={()=>setEditingTag(null)} onSave={(name,icon)=>saveAppearance(editingTag,name,icon,p.onRenameTag)} />}</>;
}

function IOSTagEditor({path,icon:initialIcon,onClose,onSave}:{path:string;icon:string;onClose:()=>void;onSave:(name:string,icon:string)=>Promise<void>}) {
  const [name,setName]=useState(path),[icon,setIcon]=useState(initialIcon),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const saving=useRef(false);
  const fields=useRef({name,icon});
  fields.current={name,icon};
  useIOSSurface("tag-editor", {
    kind:"form",title:"编辑标签",presented:true,busy,error,message:"使用 / 分隔多级标签；改名会更新笔记中的标签。",
    primary:{id:"save",title:"保存",disabled:busy || !name.trim()},
    sections:[{id:"name",fields:[{id:"name",title:"标签名称",value:name,disabled:busy},{id:"icon",title:"图标 Emoji（可留空）",value:icon,disabled:busy}]}],
  }, async(action,value)=>{
    if(saving.current)return;
    if(action === "close")onClose();
    if(action === "name"){fields.current.name=value ?? "";setName(fields.current.name);}
    if(action === "icon"){fields.current.icon=value ?? "";setIcon(fields.current.icon);}
    if(action === "save" && fields.current.name.trim()){
      saving.current=true;setBusy(true);setError("");
      try{await onSave(fields.current.name.trim(),fields.current.icon.trim());onClose();}
      catch(cause){setError(cause instanceof Error ? cause.message : "保存失败，请重试。");}
      finally{saving.current=false;setBusy(false);}
    }
  });
  return null;
}
