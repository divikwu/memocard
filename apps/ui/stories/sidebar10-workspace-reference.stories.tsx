import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { App } from "../src/App";
import { setStorybookClientMode, setStorybookRequestHandler } from "../.storybook/bridge";
import { createWorkspaceFixture } from "../ui-next/web/workspace-fixture";

// The old Storybook owns the legacy theme and CSS. Only the shared in-memory
// data fixture is imported from ui-next; no new UI or styles enter this document.
function LegacyWorkspaceReference({ scenario = "loading", initialRoute = "#/home" }: { scenario?: string; initialRoute?: string }) {
  const exampleKey = `${scenario}:${initialRoute}`;
  const [preparedScenario, setPreparedScenario] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let detach: (() => void) | undefined;
    const restoreMode = setStorybookClientMode(["disconnected", "unauthorized"].includes(scenario) ? "local-web" : "browser");
    const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    const originalUrl = location.href;
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } });
    history.replaceState(null, "", `${location.pathname}${location.search}${initialRoute}`);
    void createWorkspaceFixture(scenario).then(fixture => {
      if (!active) return;
      detach = setStorybookRequestHandler(fixture.request);
      setPreparedScenario(exampleKey);
    });
    return () => {
      active = false;
      detach?.();
      restoreMode();
      Object.defineProperty(window, "localStorage", originalStorage);
      history.replaceState(null, "", originalUrl);
    };
  }, [scenario, initialRoute, exampleKey]);
  return preparedScenario === exampleKey ? <App key={exampleKey} /> : <p role="status">正在准备旧版对照笔记库…</p>;
}

const meta = {
  title: "reference/Sidebar-10 legacy workspace",
  id: "sidebar10-legacy-workspace",
  component: LegacyWorkspaceReference,
  tags: ["!autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "真实旧版 App 的 Sidebar-10 业务适配对照，保留旧版组件和样式；不是官方原始模板。与新版 pages/Web & H5 使用相同种子和纯内存请求处理器，关闭或切换示例即重置，不访问真实笔记库。可比较保存、属性、固定、删除/恢复和草稿；示例未实现库切换、标签重命名和附件选择，这些操作会返回预览限制。官方原始骨架以 docs/ui-reference/sidebar-10.json 为准。",
      },
    },
  },
} satisfies Meta<typeof LegacyWorkspaceReference>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Workspace: Story = {};
export const NoVault: Story = { args: { scenario: "folder-cancel" } };
export const EmptyVault: Story = { args: { scenario: "empty" } };
export const Drafts: Story = { args: { scenario: "draft-many" } };
export const DraftVersions: Story = { args: { scenario: "draft-versions" } };
export const SaveFailure: Story = { args: { scenario: "save-error" } };
export const PermissionRequired: Story = { args: { scenario: "permission" } };
export const LocalServiceDisconnected: Story = { args: { scenario: "disconnected" } };

// Paired review routes use the identical in-memory fixture in both Storybooks.
export const EditorReview: Story = { args: { scenario: "review-editor", initialRoute: "#/notes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" } };
export const SearchReview: Story = { args: { scenario: "review-search", initialRoute: "#/notes" } };
export const SearchLoading: Story = { args: { scenario: "review-search-loading", initialRoute: "#/notes" } };
export const SearchFailure: Story = { args: { scenario: "review-search-error", initialRoute: "#/notes" } };
export const SettingsReview: Story = { args: { scenario: "loading", initialRoute: "#/settings" } };
export const TrashReview: Story = { args: { scenario: "review-trash", initialRoute: "#/trash" } };
export const TrashLoading: Story = { args: { scenario: "review-trash-loading", initialRoute: "#/trash" } };
export const TrashFailure: Story = { args: { scenario: "review-trash-error", initialRoute: "#/trash" } };
export const TrashIssues: Story = { args: { scenario: "review-trash-issues", initialRoute: "#/trash" } };
export const TrashRefresh: Story = { args: { scenario: "review-trash-refresh", initialRoute: "#/trash" } };
