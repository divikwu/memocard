import { useLayoutEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Note, NoteProperties, PropertyChange, PropertyType } from '@memocard/contracts';
import { setStorybookRequestHandler, setStorybookBrowserAssets } from '../../test-support/bridge';
import { Editor, type EditorHandle } from '../business/Editor';
import { Button } from '../components/button';
import { LumaStoryFrame } from '../LumaPage';
import { editorContentReview } from '../../test-support/editor-content.fixture';

const body = `## 把思考写进上下文

这里可以直接编辑 **重点**、*说明* 和 [参考链接](https://example.com)。输入 / 插入内容块，选中文字设置格式。

- [x] 保留 Markdown 源文
- [ ] 回顾未完成的想法

<aside data-callout="blue" data-callout-icon="🧭"><p>标题、正文与属性共享撤销历史。试着修改后按 ⌘/Ctrl Z。</p></aside>

| 阶段 | 内容 |
| --- | --- |
| 捕捉 | 把想法记下来 |
| 整理 | 连接笔记与属性 |

公式：$E=mc^2$

\`\`\`mermaid
graph LR
A[捕捉]-->B[整理]
B-->C[回顾]
\`\`\``;

function createFixture(failSave: boolean, initialBody = body) {
  let note: Note = { id: 'next-editor', title: '记录与表达', body: initialBody, tags: [], contentHash: 'source-0', relativePath: 'notes/next-editor.md', sourceUrl: '', createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T08:00:00Z' };
  let properties: NoteProperties = { contentHash: note.contentHash, writable: true, definitionHash: 'definition-0', tagProperty: { name: 'tags', type: 'list', value: ['设计'], editable: true }, properties: [
    { name: '摘要', type: 'text', value: '让新控件进入真实编辑工作流', editable: true },
    { name: '优先级', type: 'number', value: '2', editable: true },
    { name: '回顾日期', type: 'date', value: '2026-10-23', editable: true },
    { name: '已验证', type: 'checkbox', value: false, editable: true },
    { name: '状态', type: 'select', value: '进行中', editable: true, options: [{ name: '进行中', color: 'blue' }, { name: '已完成', color: 'green' }] },
    { name: '领域', type: 'multiSelect', value: ['产品'], editable: true, options: [{ name: '产品', color: 'purple' }, { name: '工程', color: 'orange' }] },
    { name: '配图', type: 'image', value: '', editable: true },
  ] };
  let labels: Record<string, string> = {};
  let revision = 0;
  const snapshot = () => structuredClone(note);
  return { snapshot, request(operation: string, params: Record<string, unknown>): unknown {
    if (operation === 'getPropertyLabels') return { labels, contentHash: `labels-${revision}` };
    if (operation === 'renamePropertyLabel') { labels = { ...labels, [String(params.key)]: String(params.label) }; return { labels, contentHash: `labels-${++revision}` }; }
    if (operation === 'listTags') return { tags: [{ name: '设计' }, { name: '产品' }, { name: '灵感' }] };
    if (operation === 'getNoteProperties') return structuredClone(properties);
    if (operation === 'saveDraft') return { ...params, revision: `recovery-${revision}` };
    if (operation === 'getNote') return snapshot();
    if (operation === 'pickImage') return { markdownPath: '../assets/editor.png', notePath: note.relativePath };
    if (operation === 'queryNotes') return { notes: [snapshot()], nextCursor: null, coverage: { complete: true, indexed: 1, pending: 0, issues: 0, indexedAt: null } };
    if (operation === 'saveNote') {
      if (failSave) { failSave = false; throw new Error('磁盘暂时只读（内存示例），可以重试保存。'); }
      note = { ...note, id: String(params.id), title: String(params.title ?? ''), body: String(params.body), tags: params.tags as string[], relativePath: String(params.relativePath), contentHash: `source-${++revision}` };
      properties = { ...properties, contentHash: note.contentHash };
      return snapshot();
    }
    if (operation === 'updateNoteProperty') {
      const change = params as PropertyChange;
      if (change.name === 'tags') properties = { ...properties, tagProperty: { ...properties.tagProperty!, value: change.value ?? [] } };
      else {
        const previous = properties.properties.find(property => property.name === (change.copyFrom ?? change.name));
        const next = { ...previous, name: change.renameTo ?? change.name, type: change.type ?? previous?.type ?? 'text' as PropertyType, value: change.value ?? previous?.value ?? '', editable: true, ...(change.options ? { options: change.options } : {}) };
        properties = { ...properties, properties: change.remove ? properties.properties.filter(property => property.name !== change.name) : change.create || change.copyFrom ? [...properties.properties, next] : properties.properties.some(property => property.name === change.name) ? properties.properties.map(property => property.name === change.name ? next : property) : [...properties.properties, next] };
      }
      note = { ...note, contentHash: `source-${++revision}` };
      properties = { ...properties, contentHash: note.contentHash, definitionHash: `definition-${revision}` };
      return { ...snapshot(), propertyData: structuredClone(properties) };
    }
    throw new Error(`该内存示例不支持操作 ${operation}`);
  } };
}

function editorImageBlob(color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 320;
  const context = canvas.getContext('2d')!;
  context.fillStyle = color; context.fillRect(0, 0, 480, 320);
  context.fillStyle = '#ffffff'; context.fillRect(40, 40, 400, 240);
  const bytes = Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), character => character.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

function EditorFixture({ readOnly = false, failSave = false, initialBody }: { readOnly?: boolean; failSave?: boolean; initialBody?: string }) {
  const [fixture] = useState(() => createFixture(failSave, initialBody));
  const [initial] = useState(() => fixture.snapshot());
  const [saved, setSaved] = useState('');
  const handle = useRef<EditorHandle>(null);
  useLayoutEffect(() => {
    const assets = setStorybookBrowserAssets({ 'assets/editor.png': editorImageBlob('#737373'), 'assets/editor-second.png': editorImageBlob('#3b82f6') });
    const requests = setStorybookRequestHandler(fixture.request);
    return () => { requests(); assets(); };
  }, [fixture]);
  return <LumaStoryFrame><div className="mx-auto grid w-full max-w-4xl gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><p className="text-sm text-secondary">本地交互示例：正文、属性、附件与撤销均可操作。</p><Button disabled={readOnly} onClick={() => { void handle.current?.finish(); }}>完成并保存</Button></div>
    {saved && <p role="status" className="text-sm text-secondary">{saved}</p>}
    <div className="min-w-0 md:px-12"><div className="mx-auto w-full max-w-[var(--note-measure,45rem)]">
      <Editor initial={{ id: initial.id, title: initial.title, body: initial.body, tags: initial.tags, baseHash: initial.contentHash, relativePath: initial.relativePath }} initialNote={initial} capabilities={new Set(readOnly ? ['getNoteProperties'] : ['saveNote', 'saveDraft', 'getNoteProperties', 'updateNoteProperty', 'pickImage'])} handle={handle} onClose={() => setSaved('未保存更改。')} onSaved={note => setSaved(`已保存「${note.title}」`)} />
    </div></div>
  </div></LumaStoryFrame>;
}

const meta = { title: 'business/editor', id: 'ui-next-business-editor', component: EditorFixture, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof EditorFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const ContentReview: Story = { name: '内容样式 · WEB / H5', args: { initialBody: editorContentReview } };
export const H5: Story = { tags: ["mobile"], globals: { viewport: { value: "mobile", isRotated: false } }, decorators: [Story => <div style={{ maxWidth: 390, marginInline: 'auto' }}><Story /></div>] };
export const ReadOnly: Story = { args: { readOnly: true } };
export const SaveRetry: Story = { args: { failSave: true } };
export const Images: Story = { name: '图片 · 拖动与撤销', args: { initialBody: '## 图片顺序\n\n开头：拖动图片改变位置，按 Escape 取消，或按 ⌘/Ctrl Z 撤销。\n\n![灰色卡片](../assets/editor.png)\n\n中间：第一张图片之后的文字。\n\n![蓝色卡片](../assets/editor-second.png)\n\n结尾：第二张图片之后的文字。' } };
export const ImageColumns: Story = { name: '图片 · 并排与列宽', args: { initialBody: '## 图片并排\n\n<figure data-image-columns="50,50"><img src="../assets/editor.png" alt="灰色卡片"><img src="../assets/editor-second.png" alt="蓝色卡片"><figcaption>拖动分隔线调整列宽，也可用方向键；Escape 取消、撤销恢复。</figcaption></figure>' } };
