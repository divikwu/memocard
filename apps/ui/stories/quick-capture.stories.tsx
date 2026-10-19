import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Note } from "@memocard/contracts";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookBrowserAssets, setStorybookRequestHandler } from "../.storybook/bridge";
import { desktopGlobals } from "../.storybook/viewports";
import type { Draft } from "../src/bridge";
import { QuickCapture, type QuickCaptureHandle, type QuickCaptureMemory } from "../src/components/quick-capture";
import { Button } from "../src/components/ui/button";
import { readQuickCaptureDraft, writeQuickCaptureDraft } from "../src/quick-capture-draft";
import { captureAssetPath, captureImageBlob, captureVaultBinding, captureVaultId, createCaptureFixture, restoredCapture } from "./quick-capture-fixture";

type Scenario = "compose" | "retry" | "pending" | "disabled" | "memory" | "mobile" | "restore" | "continue";
type ExampleProps = {
  scenario: Scenario;
  onRecorded: (note: Note) => void;
  onContinue: (draft: Draft) => void;
  onOpenDrafts: () => void;
};
let fixture = createCaptureFixture();

function QuickCaptureExample({ scenario, onRecorded, onContinue, onOpenDrafts }: ExampleProps) {
  const docked = ["mobile", "restore", "continue"].includes(scenario);
  const [mount, setMount] = useState(0);
  const [saved, setSaved] = useState<Note | null>(null);
  const [continued, setContinued] = useState<Draft | null>(null);
  const handle = useRef<QuickCaptureHandle | null>(null);
  const memory = useRef<QuickCaptureMemory | null>(scenario === "disabled" ? {
    vaultId: captureVaultId, vaultBinding: captureVaultBinding,
    capture: { ...restoredCapture, text: "笔记库暂不可编辑", images: [] },
  } : null);
  const editor = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (continued) editor.current?.focus(); }, [continued]);
  return <main className="mx-auto w-full max-w-2xl p-4" style={{ minHeight: docked ? "100dvh" : undefined }}>
    <p className="mb-4 text-sm text-muted-foreground">真实 QuickCapture；保存、草稿和图片选择使用当前示例的内存数据。</p>
    <div className={docked ? "mobile-record-bar" : undefined} style={docked ? { position: "fixed", bottom: 16, left: 16, right: 16 } : undefined}>
      <QuickCapture key={mount} vaultId={captureVaultId} vaultBinding={captureVaultBinding} rootNotes={false}
        tags={["工作", "生活", "设计/灵感"]} disabled={scenario === "disabled"} canImage
        handle={handle} memory={scenario === "memory" || scenario === "disabled" ? memory : undefined}
        docked={docked} draftCount={scenario === "memory" || scenario === "mobile" ? 2 : 0}
        onOpenDrafts={onOpenDrafts}
        onRecorded={note => { setSaved(note); onRecorded(note); }}
        onContinue={scenario === "continue" ? draft => { setContinued(draft); onContinue(draft); } : undefined} />
    </div>
    {scenario === "pending" && <Button variant="outline" onClick={() => fixture.completeSave()}>完成模拟保存</Button>}
    {(scenario === "memory" || scenario === "restore") && <Button variant="outline" onClick={() => setMount(value => value + 1)}>重新挂载快速记录</Button>}
    {saved && <output aria-label="模拟保存结果" className="mt-4 block text-sm">已收到记录回调：{saved.body}</output>}
    {continued && <section aria-label="页面接续示例" className="mt-4 space-y-2">
      <p className="text-sm">已收到 onContinue 草稿；以下仅示意调用方接续编辑。</p>
      <textarea ref={editor} aria-label="页面编辑内容" className="min-h-32 w-full rounded-lg border p-3" value={continued.body}
        onChange={event => setContinued({ ...continued, body: event.target.value })} />
    </section>}
  </main>;
}

const mobileGlobals = { viewport: { value: "mobile", isRotated: false } };
const mobileParameters = { docs: { story: { height: "844px" } } };

const meta = {
  title: "business/quick capture",
  component: QuickCaptureExample,
  globals: desktopGlobals,
  args: { scenario: "compose", onRecorded: fn(), onContinue: fn(), onOpenDrafts: fn() },
  argTypes: { scenario: { control: false }, onRecorded: { control: false }, onContinue: { control: false }, onOpenDrafts: { control: false } },
  parameters: {
    docs: { story: { height: "600px" }, description: { component: "生产 QuickCapture 的桌面 Web 与 H5 业务状态。真实标签 Popover、附件缩略图/大图、Sheet、草稿保护与保存回调；所有数据只留在示例内存，未连接真实笔记库。继续页面仅展示 onContinue 的接续契约，完整 Editor 不在此页。iOS 原生快速记录另见 Xcode Preview。" } },
  },
  beforeEach: async ({ args }) => {
    fixture = createCaptureFixture(args.scenario === "retry" ? "retry" : args.scenario === "pending" ? "pending" : "ready");
    const releaseRequests = setStorybookRequestHandler(fixture.request);
    const releaseAssets = setStorybookBrowserAssets({ [captureAssetPath]: await captureImageBlob() });
    if (args.scenario === "restore") writeQuickCaptureDraft(captureVaultId, structuredClone(restoredCapture));
    await import("../src/components/ui/sheet-swipe");
    return () => { releaseAssets(); releaseRequests(); };
  },
} satisfies Meta<typeof QuickCaptureExample>;
export default meta;
type Story = StoryObj<typeof meta>;

async function openCapture(canvasElement: HTMLElement) {
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(within(canvasElement).getByRole("button", { name: "打开快速记录" }));
  const sheet = await page.findByRole("dialog", { name: "快速记录" });
  const input = within(sheet).getByRole("textbox", { name: "快速输入内容" });
  await waitFor(() => expect(input).toHaveFocus());
  return { page, sheet, input, form: within(sheet).getByRole("form", { name: "快速输入" }) };
}

async function chooseTag(page: ReturnType<typeof within>, form: HTMLElement, name: string) {
  const trigger = within(form).getByRole("button", { name: "选择标签" });
  await userEvent.click(trigger);
  const picker = await page.findByRole("dialog", { name: "选择标签" });
  await userEvent.click(within(picker).getByRole("button", { name }));
  await expect(within(picker).getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(within(form).getByRole("button", { name: `移除标签 ${name}` })).toBeVisible();
}

async function attachPreviewAndRemove(page: ReturnType<typeof within>, form: HTMLElement) {
  await userEvent.click(within(form).getByRole("button", { name: "添加图片" }));
  const image = await within(form).findByRole("button", { name: "查看大图 待记录图片 1" });
  await waitFor(() => expect(image).toHaveAttribute("data-image-state", "loaded"));
  await userEvent.click(image);
  const viewer = await page.findByRole("dialog", { name: "待记录图片 1" });
  await waitFor(() => expect(within(viewer).getByRole("img", { name: "待记录图片 1" })).toBeVisible());
  await userEvent.click(within(viewer).getByRole("button", { name: "关闭图片" }));
  await waitFor(() => expect(image).toHaveFocus());
  await userEvent.click(within(form).getByRole("button", { name: "移除图片 1" }));
  await expect(within(form).queryByRole("img", { name: "待记录图片 1" })).not.toBeInTheDocument();
}

export const DesktopCompose: Story = {
  name: "desktop · 输入、标签与图片",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const form = canvas.getByRole("form", { name: "快速输入" });
    await expect(within(form).getByRole("button", { name: "记录" })).toBeDisabled();
    await userEvent.type(within(form).getByRole("textbox", { name: "快速输入内容" }), "一个值得记下的想法 #灵感");
    await chooseTag(page, form, "工作");
    await userEvent.click(within(form).getByRole("button", { name: "选择标签" }));
    const picker = await page.findByRole("dialog", { name: "选择标签" });
    await userEvent.type(within(picker).getByRole("textbox", { name: "搜索或新建标签" }), "新想法");
    await userEvent.click(within(picker).getByRole("button", { name: "新建标签 新想法" }));
    await expect(within(picker).getByRole("textbox", { name: "搜索或新建标签" })).toHaveValue("");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(form).getByRole("button", { name: "移除标签 新想法" }));
    await expect(within(form).queryByRole("button", { name: "移除标签 新想法" })).not.toBeInTheDocument();
    await attachPreviewAndRemove(page, form);
    await expect(args.onRecorded).not.toHaveBeenCalled();
    await expect(fixture.calls.map(call => call.operation)).toEqual(["pickImage"]);
  },
};

export const DesktopRetry: Story = {
  name: "desktop · 保存失败与重试",
  args: { scenario: "retry" },
  parameters: { docs: { description: { story: "第一次记录返回可见错误；原输入、标签、附件和笔记 ID 保留。第二次记录成功后清空并调用 onRecorded。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "快速输入内容" });
    await userEvent.type(input, "保存失败也保留");
    await chooseTag(within(canvasElement.ownerDocument.body), canvas.getByRole("form"), "生活");
    await userEvent.click(canvas.getByRole("button", { name: "添加图片" }));
    await canvas.findByRole("button", { name: "移除图片 1" });
    await userEvent.click(canvas.getByRole("button", { name: "记录" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("磁盘只读（内存示例）");
    await expect(input).toHaveValue("保存失败也保留");
    await expect(canvas.getByRole("button", { name: "移除标签 生活" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "移除图片 1" })).toBeVisible();
    await expect(args.onRecorded).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "记录" }));
    await waitFor(() => expect(args.onRecorded).toHaveBeenCalledOnce());
    const writes = fixture.calls.filter(call => call.operation === "saveNote");
    await expect(writes).toHaveLength(2);
    await expect(writes[1].params).toEqual(writes[0].params);
    await expect(writes[1].params).toMatchObject({ body: "保存失败也保留\n\n![图片](../assets/quick-capture.png)", inheritedTags: ["生活"], baseHash: null, vaultId: captureVaultId, vaultBinding: captureVaultBinding });
    await expect(input).toHaveValue("");
    await expect(canvas.queryByRole("button", { name: "移除标签 生活" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "移除图片 1" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(input).toHaveFocus());
  },
};

export const DesktopPending: Story = {
  name: "desktop · 保存进行中",
  args: { scenario: "pending" },
  parameters: { docs: { description: { story: "点击记录后保持 pending；使用示例按钮“完成模拟保存”确定性地完成请求。处理期间输入和动作禁用，快捷键不会重复提交。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "快速输入内容" });
    await userEvent.type(input, "只记录一次");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await waitFor(() => expect(canvas.getByRole("form")).toHaveAttribute("aria-busy", "true"));
    await expect(input).toBeDisabled();
    for (const name of ["选择标签", "添加图片", "处理中"]) await expect(canvas.getByRole("button", { name })).toBeDisabled();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await expect(fixture.calls.filter(call => call.operation === "saveNote")).toHaveLength(1);
    await expect(args.onRecorded).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "完成模拟保存" }));
    await waitFor(() => expect(args.onRecorded).toHaveBeenCalledOnce());
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("");
    await expect(canvas.getByRole("form")).toHaveAttribute("aria-busy", "false");
  },
};

export const DesktopDisabled: Story = {
  name: "desktop · 笔记库不可编辑",
  args: { scenario: "disabled" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "快速输入内容" });
    await expect(input).toHaveValue("笔记库暂不可编辑");
    await expect(input).toBeDisabled();
    for (const name of ["选择标签", "添加图片", "记录", "移除标签 工作"]) await expect(canvas.getByRole("button", { name })).toBeDisabled();
    await expect(fixture.calls).toHaveLength(0);
    await expect(args.onRecorded).not.toHaveBeenCalled();
  },
};

export const DesktopMemory: Story = {
  name: "desktop · 页面内草稿与草稿入口",
  args: { scenario: "memory" },
  parameters: { docs: { description: { story: "组件通过生产 memory ref 在同一页面重新挂载后保留输入；这与 H5 的 localStorage 恢复是两条不同的生产路径。草稿入口只发出回调，不提交当前内容。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "快速输入内容" }), "同一页面继续保留的想法");
    await chooseTag(within(canvasElement.ownerDocument.body), canvas.getByRole("form"), "工作");
    await userEvent.click(canvas.getByRole("button", { name: "保留草稿（2）" }));
    await expect(args.onOpenDrafts).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "重新挂载快速记录" }));
    await expect(canvas.getByRole("textbox", { name: "快速输入内容" })).toHaveValue("同一页面继续保留的想法");
    await expect(canvas.getByRole("button", { name: "移除标签 工作" })).toBeVisible();
    await expect(readQuickCaptureDraft(captureVaultId)).toBeNull();
    await expect(fixture.calls).toHaveLength(0);
  },
};

export const MobileDocked: Story = {
  name: "H5 · 展开、收起与未提交输入",
  args: { scenario: "mobile" },
  tags: ["mobile"], globals: mobileGlobals, parameters: mobileParameters,
  play: async ({ canvasElement, args }) => {
    const { page, sheet, input, form } = await openCapture(canvasElement);
    await userEvent.type(input, "随手记下的手机想法");
    await chooseTag(page, form, "设计/灵感");
    await attachPreviewAndRemove(page, form);
    await expect(readQuickCaptureDraft(captureVaultId)).toMatchObject({ text: "随手记下的手机想法", tags: ["设计/灵感"] });
    await expect(readQuickCaptureDraft(captureVaultId)?.images).toEqual([]);
    await userEvent.click(within(sheet).getByRole("button", { name: "收起快速记录" }));
    await waitFor(() => expect(page.queryByRole("dialog", { name: "快速记录" })).not.toBeInTheDocument());
    const trigger = within(canvasElement).getByRole("button", { name: "打开快速记录" });
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(trigger).toHaveTextContent("随手记下的手机想法");
    const reopened = await openCapture(canvasElement);
    await expect(reopened.input).toHaveValue("随手记下的手机想法");
    await expect(within(reopened.form).getByRole("button", { name: "移除标签 设计/灵感" })).toBeVisible();
    await userEvent.click(within(reopened.form).getByRole("button", { name: "保留草稿（2）" }));
    await waitFor(() => expect(page.queryByRole("dialog", { name: "快速记录" })).not.toBeInTheDocument());
    await expect(args.onOpenDrafts).toHaveBeenCalledOnce();
    await expect(args.onRecorded).not.toHaveBeenCalled();
    await expect(fixture.calls.map(call => call.operation)).toEqual(["pickImage"]);
  },
};

export const MobileRestore: Story = {
  name: "H5 · 恢复草稿、重新挂载与记录",
  args: { scenario: "restore" },
  tags: ["mobile"], globals: mobileGlobals, parameters: mobileParameters,
  play: async ({ canvasElement, args }) => {
    const { page, sheet, input, form } = await openCapture(canvasElement);
    await expect(input).toHaveValue(restoredCapture.text);
    await expect(within(form).getByRole("button", { name: "移除标签 工作" })).toBeVisible();
    await waitFor(() => expect(within(form).getByRole("button", { name: "查看大图 待记录图片 1" })).toHaveAttribute("data-image-state", "loaded"));
    await userEvent.type(input, "，接着补充");
    await userEvent.click(within(sheet).getByRole("button", { name: "收起快速记录" }));
    await waitFor(() => expect(page.queryByRole("dialog", { name: "快速记录" })).not.toBeInTheDocument());
    await userEvent.click(within(canvasElement).getByRole("button", { name: "重新挂载快速记录" }));
    const reopened = await openCapture(canvasElement);
    await expect(reopened.input).toHaveValue(`${restoredCapture.text}，接着补充`);
    await expect(readQuickCaptureDraft(captureVaultId)?.id).toBe(restoredCapture.id);
    await userEvent.click(within(reopened.form).getByRole("button", { name: "记录" }));
    await waitFor(() => expect(args.onRecorded).toHaveBeenCalledOnce());
    await waitFor(() => expect(page.queryByRole("dialog", { name: "快速记录" })).not.toBeInTheDocument());
    await expect(readQuickCaptureDraft(captureVaultId)).toBeNull();
    await expect(fixture.calls.map(call => call.operation)).toEqual(["saveNote"]);
    await expect(fixture.calls[0].params).toMatchObject({ id: restoredCapture.id, body: `${restoredCapture.text}，接着补充\n\n![图片](../assets/quick-capture.png)`, inheritedTags: ["工作"] });
    const blank = await openCapture(canvasElement);
    await expect(blank.input).toHaveValue("");
    await expect(within(blank.form).queryByRole("button", { name: "移除图片 1" })).not.toBeInTheDocument();
    await expect(within(blank.form).getByRole("button", { name: "记录" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog", { name: "快速记录" })).not.toBeInTheDocument());
  },
};

export const MobileContinue: Story = {
  name: "H5 · 切换为页面",
  args: { scenario: "continue" },
  tags: ["mobile"], globals: mobileGlobals, parameters: mobileParameters,
  play: async ({ canvasElement, args }) => {
    const { page, input, form } = await openCapture(canvasElement);
    await userEvent.type(input, "  要继续展开的想法  ");
    await chooseTag(page, form, "工作");
    await userEvent.click(within(form).getByRole("button", { name: "切换为页面" }));
    await waitFor(() => expect(args.onContinue).toHaveBeenCalledOnce());
    await expect(args.onContinue).toHaveBeenCalledWith(expect.objectContaining({ body: "  要继续展开的想法  ", inheritedTags: ["工作"], title: undefined, recoveredFrom: { draftKey: "storybook-page-draft", revision: "storybook-revision-1" } }));
    await expect(fixture.calls.map(call => call.operation)).toEqual(["saveDraft"]);
    await expect(args.onRecorded).not.toHaveBeenCalled();
    await expect(readQuickCaptureDraft(captureVaultId)).toBeNull();
    await waitFor(() => expect(page.queryByRole("dialog", { name: "快速记录" })).not.toBeInTheDocument());
    const editor = within(canvasElement).getByRole("textbox", { name: "页面编辑内容" });
    await waitFor(() => expect(editor).toHaveFocus());
    await userEvent.type(editor, "继续编辑");
    await expect(editor).toHaveValue("  要继续展开的想法  继续编辑");
  },
};
