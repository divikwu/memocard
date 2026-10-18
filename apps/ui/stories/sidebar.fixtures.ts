import { fn } from "storybook/test";
import type { AppSidebarProps } from "../src/components/app-sidebar";

export const sidebarTags = [
  { name: "产品", count: 12 },
  { name: "体验", count: 8 },
  { name: "体验/使用指南", count: 3 },
  { name: "体验/使用指南/快捷操作", count: 1 },
  { name: "体验/文本", count: 2 },
  { name: "体验/离线", count: 3 },
  { name: "学习", count: 6 },
  { name: "学习/swiftui", count: 4 },
  { name: "学习/英语", count: 2 },
  { name: "工作", count: 5 },
];

export function sidebarArgs(overrides: Partial<AppSidebarProps> = {}): AppSidebarProps {
  return {
    view: "notes", tag: "产品", tags: sidebarTags,
    vaultName: "我的笔记", vaultId: "storybook-sidebar",
    registeredVaults: [{ vaultId: "storybook-sidebar", name: "我的笔记", active: true }, { vaultId: "storybook-personal", name: "个人", active: false }],
    connected: true, canTrash: true, vaultStatusText: "已连接文件夹", hasVaultIssue: false,
    canCreate: true, canChooseVault: true, canCreateVault: true, needsPermission: false, working: false,
    filterCounts: { untagged: 3, images: 2, links: 1 },
    onNavigate: fn(), onNewNote: fn(), onSearch: fn(), onSelectVault: fn(), onActivateVault: fn(), onReauthorize: fn(),
    ...overrides,
  };
}
