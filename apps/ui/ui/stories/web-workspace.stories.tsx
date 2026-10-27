import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { App } from "../../src/App";
import { expect, userEvent, within } from "storybook/test";
import { setStorybookClientMode, setStorybookRequestHandler } from "../../test-support/bridge";
import { StorybookAppearanceBridge } from "../web/StorybookAppearanceBridge";
import { createWorkspaceFixture } from "../web/workspace-fixture";

function WorkspaceExample({ scenario = "loading", initialRoute = "#/home" }: { scenario?: string; initialRoute?: string }) {
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
    return () => { active = false; detach?.(); restoreMode(); Object.defineProperty(window, "localStorage", originalStorage); history.replaceState(null, "", originalUrl); };
  }, [scenario, initialRoute, exampleKey]);
  return <StorybookAppearanceBridge>{preparedScenario === exampleKey ? <App key={exampleKey} /> : <p role="status">正在准备示例笔记库…</p>}</StorybookAppearanceBridge>;
}
const meta = { title: "pages/Web & H5", id: "ui-web", component: WorkspaceExample, parameters: { layout: "fullscreen", docs: { description: { component: "使用真实页面控制器与当前业务组件。示例笔记只存于内存，关闭或切换示例即重置，不连接你的笔记库。" } } } } satisfies Meta<typeof WorkspaceExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Workspace: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByRole("heading", { name: "主页", level: 1 })).toBeVisible();
  await expect(await canvas.findByRole("textbox", { name: "快速输入内容" })).toBeVisible();
} };
export const TagBreadcrumb: Story = { tags: ["!dev", "!autodocs"], args: { initialRoute: "#/notes" }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click((await canvas.findAllByRole("button", { name: "筛选标签 生活/咖啡" }))[0]);
  await userEvent.click(await canvas.findByRole("button", { name: "打开 今天的手冲记录" }));
  await canvas.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = within(canvas.getByRole("navigation", { name: "当前位置" }));
  await expect(breadcrumb.getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "生活", "咖啡"]);
} };
export const NoVault: Story = { args: { scenario: "folder-cancel" } };
export const SaveFailure: Story = { args: { scenario: "save-error" } };
export const DraftRecovery: Story = { args: { scenario: "draft-many" } };
export const EmptyVault: Story = { args: { scenario: "empty" } };
export const PermissionRequired: Story = { args: { scenario: "permission" } };
export const LocalServiceDisconnected: Story = { args: { scenario: "disconnected" } };
export const UnsupportedBrowser: Story = { args: { scenario: "unsupported" } };
export const DraftVersions: Story = { args: { scenario: "draft-versions" } };

// Review routes preserve the existing in-memory fixture and state coverage.
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
