import type { NoteFilterCounts, NoteQuickFilter } from "@memocard/contracts";
import type { RegisteredVault } from "../../src/bridge";

export type WorkspaceView = "home" | "notes" | "tags" | "settings" | "trash";
export interface WorkspaceNavigationProps {
  view: WorkspaceView;
  detailView?: boolean;
  detailBack?: { label: string; run: () => void };
  tag: string | null;
  quickFilter?: NoteQuickFilter | null;
  filterCounts?: NoteFilterCounts;
  tags: { name: string; count: number }[];
  loadingTags?: boolean;
  vaultName: string;
  vaultId?: string | null;
  registeredVaults?: RegisteredVault[];
  onRenameTag?: (from: string, to: string) => Promise<void>;
  connected?: boolean;
  canTrash?: boolean;
  vaultStatusText: string;
  hasVaultIssue: boolean;
  canCreate: boolean;
  canChooseVault: boolean;
  canCreateVault: boolean;
  needsPermission: boolean;
  working: boolean;
  onNavigate: (view: WorkspaceView, tag?: string | null, quickFilter?: NoteQuickFilter | null) => void;
  onNewNote: () => void;
  onSearch: () => void;
  onSelectVault: (create: boolean) => void;
  onActivateVault: (vaultId: string) => void;
  onReauthorize: () => void;
  canRefresh?: boolean;
  onRefresh?: () => void;
  draftCount?: number;
  onOpenDrafts?: () => void;
  searchAvailable?: boolean;
  searchOpen?: boolean;
}

export const workspaceFilters = [
  { id: "untagged", label: "无标签", icon: "hash" },
  { id: "images", label: "有图片", icon: "image" },
  { id: "links", label: "有链接", icon: "link" },
] as const;

export function workspaceActions(p: WorkspaceNavigationProps) {
  const action = (label: string, disabled: boolean, run: () => void) => ({ label, disabled, run: () => { if (!disabled) run(); } });
  return {
    home: action("主页", false, () => p.onNavigate("home", undefined, undefined)),
    notes: action("所有笔记", false, () => p.onNavigate("notes", null, undefined)),
    tags: action("标签", false, () => p.onNavigate("tags", undefined, undefined)),
    settings: action("设置", false, () => p.onNavigate("settings", undefined, undefined)),
    trash: action("回收站", !p.connected || !p.canTrash, () => p.onNavigate("trash", undefined, undefined)),
    search: action("搜索", !(p.searchAvailable ?? p.connected), p.onSearch),
    newNote: action("新建笔记", !p.canCreate || p.working, p.onNewNote),
    openVault: action("打开已有笔记库", !p.canChooseVault || p.working, () => p.onSelectVault(false)),
    createVault: action("创建新笔记库", !p.canCreateVault || p.working, () => p.onSelectVault(true)),
    reauthorize: action("重新授权文件夹", !p.needsPermission || p.working, p.onReauthorize),
    refresh: action("刷新笔记库", !p.canRefresh, () => p.onRefresh?.()),
    drafts: action(`保留草稿（${p.draftCount ?? 0}）`, !p.onOpenDrafts, () => p.onOpenDrafts?.()),
  };
}

export function workspaceVaultActions(p: WorkspaceNavigationProps, vaults = p.registeredVaults ?? []) {
  return vaults.map(vault => ({ ...vault, disabled: p.working, run: () => {
    if (p.working) return;
    if (vault.active) p.onNavigate("notes", undefined, undefined); else p.onActivateVault(vault.vaultId);
  } }));
}
