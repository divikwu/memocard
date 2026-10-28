import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Note, NoteProperties, PropertyChange, PropertyType } from '@memocard/contracts';
import { setStorybookRequestHandler, setStorybookBrowserAssets } from '../../test-support/bridge';
import { Editor, type EditorHandle } from '../business/Editor';
import { NoteMarkdown } from '../business/NoteMarkdown';
import { Button } from '../components/button';
import { LumaStoryFrame } from '../LumaPage';
import { editorContentReview } from '../../test-support/editor-content.fixture';
import { blockSpacingBody } from '../../ui-state-fixtures/block-spacing';
import { defaults } from '../../src/features/typography/preferences';
import { resolveTypography } from '../../src/features/typography/TypographyProvider';

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

function createFixture(failSave: boolean, initialBody = body, initialTitle = '记录与表达', initialTags?: string[]) {
  let note: Note = { id: 'ui-editor', title: initialTitle, body: initialBody, tags: initialTags ?? [], contentHash: 'source-0', relativePath: 'notes/ui-editor.md', sourceUrl: '', createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T08:00:00Z' };
  let properties: NoteProperties = { contentHash: note.contentHash, writable: true, definitionHash: 'definition-0', tagProperty: { name: 'tags', type: 'list', value: initialTags ?? ['设计'], editable: true }, properties: [
    { name: '摘要', type: 'text', value: '让控件进入真实编辑工作流', editable: true },
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

function EditorFixture({ readOnly = false, failSave = false, initialBody, initialTitle, initialTags }: { readOnly?: boolean; failSave?: boolean; initialBody?: string; initialTitle?: string; initialTags?: string[] }) {
  const [fixture] = useState(() => createFixture(failSave, initialBody, initialTitle, initialTags));
  const [initial] = useState(() => fixture.snapshot());
  const [saved, setSaved] = useState('');
  const handle = useRef<EditorHandle>(null);
  useLayoutEffect(() => {
    const assets = setStorybookBrowserAssets({ 'assets/editor.png': editorImageBlob('#737373'), 'assets/editor-second.png': editorImageBlob('#3b82f6'), 'assets/spacing-wide.png': editorImageBlob('#e5e7eb'), 'assets/spacing-detail.png': editorImageBlob('#cbd5e1') });
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

const meta = { title: 'business/editor', id: 'ui-business-editor', component: EditorFixture, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof EditorFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const ContentReview: Story = { name: '内容样式 · WEB / H5', args: { initialBody: editorContentReview } };
export const H5: Story = { tags: ["mobile"], globals: { viewport: { value: "mobile", isRotated: false } }, decorators: [Story => <div style={{ maxWidth: 390, marginInline: 'auto' }}><Story /></div>] };
export const ReadOnly: Story = { args: { readOnly: true } };
export const SaveRetry: Story = { args: { failSave: true } };
export const Images: Story = { name: '图片 · 拖动与撤销', args: { initialBody: '## 图片顺序\n\n开头：拖动图片改变位置，按 Escape 取消，或按 ⌘/Ctrl Z 撤销。\n\n![灰色卡片](../assets/editor.png)\n\n中间：第一张图片之后的文字。\n\n![蓝色卡片](../assets/editor-second.png)\n\n结尾：第二张图片之后的文字。' } };
export const ImageColumns: Story = { name: '图片 · 并排与列宽', args: { initialBody: '## 图片并排\n\n<figure data-image-columns="50,50"><img src="../assets/editor.png" alt="灰色卡片"><img src="../assets/editor-second.png" alt="蓝色卡片"><figcaption>拖动分隔线调整列宽，也可用方向键；Escape 取消、撤销恢复。</figcaption></figure>' } };

const detailLayoutTitle = '从零散记录到持续积累：一份包含长标题、多级标签与丰富内容块的知识库实践指南 · Capture, Connect and Grow';
const detailLayoutTags = ['project/memocard', 'area/design', 'area/product', 'area/engineering', 'area/ai', 'area/management', 'resource/design-systems', 'resource/accessibility', 'resource/typography', 'resource/tools', 'journal', 'journal/coffee', 'idea', 'insight', 'reflection', 'system', 'inbox', 'project/portfolio', 'project/research', 'area/photography'];
const detailLayoutBody = `这一段用于检查正文的左右基线与自然换行。阅读列应保持稳定，标题、属性和内容块之间有明确层级。

连续的第二段保留独立编辑与选择区域；选中内容块时，文字位置和原有内容背景不应改变。

${editorContentReview}

## 嵌套任务与连续列表

- [ ] 整理研究材料
  - [x] 核对标题、属性和正文基线
  - [ ] 验证窄屏换行与标签编辑
- [ ] 检查连续段落的阅读节奏
- [x] 保留多级内容结构

最后一段用于检查列表结束后的留白与文档底部的编辑空间。`;

export const DetailLayout: Story = {
  name: '详情排版 · 长标题与多标签',
  args: { initialTitle: detailLayoutTitle, initialTags: detailLayoutTags, initialBody: detailLayoutBody },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('textbox', { name: '页面标题' })).toHaveValue(detailLayoutTitle);
    await expect(await canvas.findByRole('textbox', { name: '笔记内容' })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: '编辑标签' })).toBeVisible();
  },
};
export const DetailLayoutMobile: Story = {
  ...DetailLayout,
  name: '详情排版 · 窄屏',
  tags: ['mobile'],
  globals: { viewport: { value: 'mobile', isRotated: false } },
  decorators: [Story => <div style={{ maxWidth: 390, marginInline: 'auto' }}><Story /></div>],
};

async function verifyHighlight(field: HTMLElement, block: HTMLElement, target = block) {
  let color = '';
  await waitFor(() => {
    const svg = field.closest('.rich-editor')!.querySelector<SVGSVGElement>('.rich-block-highlights')!;
    expect(svg).not.toBeNull();
    const path = svg.querySelector('path')!;
    const blocks = Array.from(field.querySelectorAll<HTMLElement>('.rich-selected-block, .ProseMirror-selectednode'))
      .filter(element => !element.parentElement?.closest('.rich-selected-block, .ProseMirror-selectednode') && element.getClientRects().length);
    const segments = path.getAttribute('d')!.match(/M[^M]+/g)!;
    expect(segments).toHaveLength(blocks.length);
    const segment = segments[blocks.indexOf(block)];
    expect(segment).toBeDefined();
    const sample = field.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
    sample.setAttribute('d', segment); svg.append(sample);
    const box = sample.getBBox(); sample.remove();
    const origin = svg.getBoundingClientRect(), bounds = target.getBoundingClientRect(), style = getComputedStyle(target);
    let { left, right, top, bottom } = bounds;
    if (target.matches('p, h1, h2, h3, h4, h5, h6, ul, ol, li')) {
      top += parseFloat(style.paddingTop) || 0; bottom -= parseFloat(style.paddingBottom) || 0;
      if (target.matches('p, h1, h2, h3, h4, h5, h6')) {
        left += parseFloat(style.paddingLeft) || 0; right -= parseFloat(style.paddingRight) || 0;
      }
      if (target.matches('li')) left = target.parentElement!.getBoundingClientRect().left;
    }
    if (target.matches('table')) {
      const clip = target.closest('.tableWrapper')!.getBoundingClientRect();
      left = Math.max(left, clip.left); right = Math.min(right, clip.right);
    }
    expect(Math.abs(left - (origin.left + box.x) - 4)).toBeLessThan(0.1);
    expect(Math.abs(top - (origin.top + box.y) - 4)).toBeLessThan(0.1);
    expect(Math.abs(origin.left + box.x + box.width - right - 4)).toBeLessThan(0.1);
    expect(Math.abs(origin.top + box.y + box.height - bottom - 4)).toBeLessThan(0.1);
    for (const corner of [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]) {
      const radius = Math.min((parseFloat(corner) || 0) + 4, box.width / 2, box.height / 2);
      expect(segment).toContain(`A${radius} ${radius} `);
    }
    expect(getComputedStyle(svg).pointerEvents).toBe('none');
    expect(svg.closest('.rich-editor-content')).toBeNull();
    color = getComputedStyle(svg).fill;
  });
  return { backgroundColor: color };
}

export const DetailLayoutRegression: Story = {
  ...DetailLayout,
  name: '详情排版 · 块选区回归',
  tags: ['!dev', '!autodocs'],
  decorators: [Story => <div className="note-page-scroll" style={{ height: '100vh', paddingInline: 16, overflowY: 'auto' }}><Story /></div>],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('textbox', { name: '页面标题' })).toHaveValue(detailLayoutTitle);
    await expect(await canvas.findByRole('textbox', { name: '笔记内容' })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: '编辑标签' })).toBeVisible();
    const editor = canvasElement.querySelector<HTMLElement>('.ui-note-editor')!;
    await waitFor(() => expect(editor.scrollWidth).toBeLessThanOrEqual(editor.clientWidth + 1));
    await canvasElement.ownerDocument.fonts.ready;
    const field = canvas.getByRole('textbox', { name: '笔记内容' });
    const richEditor = (field as HTMLElement & { editor: TiptapEditor }).editor;
    const originalContent = richEditor.state.doc.content;
    const verifyBlockSelection = async (block: HTMLElement) => {
      block.scrollIntoView({ block: 'center' });
      const before = block.getBoundingClientRect(), text = block.textContent, background = getComputedStyle(block).backgroundColor, scrollWidth = block.scrollWidth;
      await userEvent.pointer({ target: block, coords: { clientX: before.left + 8, clientY: before.top + before.height / 2 } });
      await userEvent.click(canvas.getByRole('button', { name: '内容块操作' }));
      const popup = await within(canvasElement.ownerDocument.body).findByRole('menu', { name: '内容块操作菜单' });
      await expect(popup).toBeVisible();
      await expect(['top', 'bottom']).toContain(popup.getAttribute('data-side'));
      await waitFor(() => expect(block.matches('.rich-selected-block, .ProseMirror-selectednode'), `选择 ${block.tagName}「${text?.slice(0, 20)}」`).toBe(true));
      await expect(block.textContent).toBe(text);
      const after = block.getBoundingClientRect();
      await expect(Math.abs(after.width - before.width)).toBeLessThan(0.5);
      await expect(Math.abs(after.height - before.height)).toBeLessThan(0.5);
      await expect(getComputedStyle(block).backgroundColor).toBe(background);
      await expect(block.scrollWidth).toBe(scrollWidth);
      const overlay = await verifyHighlight(field, block, block.querySelector('table') ?? block);
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(within(canvasElement.ownerDocument.body).queryByRole('menu', { name: '内容块操作菜单' })).not.toBeInTheDocument());
      await waitFor(() => expect(field).toHaveFocus());
      return overlay;
    };
    const paragraph = field.querySelectorAll<HTMLElement>(':scope > p')[1];
    const paragraphSelection = await verifyBlockSelection(paragraph);
    const code = Array.from(field.querySelectorAll('pre')).find(element => element.textContent?.includes('const message'))!;
    await verifyBlockSelection(code);
    const table = field.querySelector('table')!, tableWrapper = table.closest<HTMLElement>('.tableWrapper')!, tableBlock = table.closest<HTMLElement>('.rich-table-block')!;
    const tableBlockSelection = await verifyBlockSelection(tableBlock);
    await expect(tableBlockSelection).toEqual(paragraphSelection);
    await expect(richEditor.state.selection.toJSON().type).toBe('node');
    await expect(table.querySelectorAll('.selectedCell')).toHaveLength(0);
    await expect(getComputedStyle(tableBlock).paddingBlock).toBe('6px');
    await expect(getComputedStyle(tableBlock).paddingBlock).toBe(getComputedStyle(paragraph).paddingBlock);
    await waitFor(() => expect(tableWrapper.dataset.overflow).toBe(String(table.scrollWidth > tableWrapper.clientWidth + 1)));
    const overflowHint = getComputedStyle(tableWrapper, '::after').content;
    if (tableWrapper.dataset.overflow === 'true') await expect(overflowHint).toContain('左右滚动查看完整表格');
    table.scrollIntoView({ block: 'center' });
    const tableBefore = table.getBoundingClientRect(), tableText = table.textContent, tableBackground = getComputedStyle(table).backgroundColor, tableScrollWidth = tableWrapper.scrollWidth;
    const cells = Array.from(table.querySelectorAll('td, th'));
    const cellsBefore = cells.map(cell => ({ padding: getComputedStyle(cell).padding, width: cell.getBoundingClientRect().width, height: cell.getBoundingClientRect().height }));
    const verifyTableGeometry = async () => {
      const after = table.getBoundingClientRect();
      await expect(Math.abs(after.width - tableBefore.width)).toBeLessThan(0.5);
      await expect(Math.abs(after.height - tableBefore.height)).toBeLessThan(0.5);
      await expect(getComputedStyle(table).backgroundColor).toBe(tableBackground);
      await expect(tableWrapper.scrollWidth).toBe(tableScrollWidth);
      await expect(getComputedStyle(tableBlock).paddingBlock).toBe(getComputedStyle(paragraph).paddingBlock);
      for (const [index, cell] of cells.entries()) {
        const rect = cell.getBoundingClientRect();
        await expect(getComputedStyle(cell).padding).toBe(cellsBefore[index].padding);
        await expect(Math.abs(rect.width - cellsBefore[index].width)).toBeLessThan(0.5);
        await expect(Math.abs(rect.height - cellsBefore[index].height)).toBeLessThan(0.5);
      }
      await expect(getComputedStyle(tableWrapper, '::after').content).toBe(overflowHint);
      await expect(richEditor.state.doc.content.eq(originalContent)).toBe(true);
    };
    const verifyTableBlockOverlay = async () => {
      const selection = await verifyHighlight(field, tableBlock, table);
      await expect(selection.backgroundColor).toBe(paragraphSelection.backgroundColor);
      await expect(table.querySelectorAll('.selectedCell')).toHaveLength(0);
      for (const cell of cells) await expect(getComputedStyle(cell, '::after').backgroundColor).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
      await verifyTableGeometry();
    };
    await verifyTableBlockOverlay();
    if (tableWrapper.scrollWidth > tableWrapper.clientWidth + 1) {
      tableWrapper.scrollLeft = tableWrapper.scrollWidth;
      await waitFor(() => expect(tableWrapper.scrollLeft).toBeGreaterThan(0));
      await verifyTableBlockOverlay();
      tableWrapper.scrollLeft = 0;
      await waitFor(() => expect(tableWrapper.scrollLeft).toBe(0));
      await verifyTableBlockOverlay();
    }
    const followingBlock = tableBlock.nextElementSibling as HTMLElement;
    await expect(followingBlock.tagName).toBe('P');
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await waitFor(() => expect(richEditor.state.selection.toJSON().type).toBe('blockRange'));
    await expect(Array.from(field.querySelectorAll('.rich-selected-block'))).toEqual([tableBlock, followingBlock]);
    const followingSelection = await verifyHighlight(field, followingBlock);
    await expect(followingSelection.backgroundColor).toBe(paragraphSelection.backgroundColor);
    await verifyTableBlockOverlay();
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    await waitFor(() => expect(richEditor.state.selection.toJSON().type).toBe('node'));
    await expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
    await verifyTableBlockOverlay();

    await userEvent.click(paragraph);
    await userEvent.keyboard('{Control>}a{/Control}{Control>}a{/Control}');
    await waitFor(() => expect(richEditor.state.selection.toJSON().type).toBe('all'));
    await expect(tableBlock.matches('.rich-selected-block')).toBe(true);
    await expect(table.textContent).toBe(tableText);
    await verifyTableBlockOverlay();

    const firstCell = table.rows[1].cells[0], lastCell = table.rows[2].cells[1];
    const cellPosition = (cell: HTMLElement) => richEditor.view.posAtDOM(cell, 0) - 1;
    for (const selected of [new Set([firstCell]), new Set([firstCell, table.rows[1].cells[1], table.rows[2].cells[0], lastCell])]) {
      const head = selected.size === 1 ? firstCell : lastCell;
      richEditor.commands.setCellSelection({ anchorCell: cellPosition(firstCell), headCell: cellPosition(head) });
      richEditor.view.focus();
      await waitFor(() => expect(table.querySelectorAll('.selectedCell')).toHaveLength(selected.size));
      await expect(richEditor.state.selection.toJSON().type).toBe('cell');
      await expect(tableBlock.matches('.rich-selected-block, .ProseMirror-selectednode')).toBe(false);
      await expect(editor.querySelector('.rich-block-highlights')).toBeNull();
      await expect(getComputedStyle(tableBlock, '::after').content).toBe('none');
      for (const cell of cells) {
        const selection = getComputedStyle(cell, '::after');
        if (selected.has(cell as HTMLTableCellElement)) {
          await expect(selection.backgroundColor).toBe(paragraphSelection.backgroundColor);
          await expect(selection.inset).toBe('0px');
          await expect(selection.pointerEvents).toBe('none');
        } else await expect(selection.backgroundColor).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
      }
      await verifyTableGeometry();
      await expect(await verifyBlockSelection(tableBlock)).toEqual(paragraphSelection);
      await expect(richEditor.state.selection.toJSON().type).toBe('node');
      await verifyTableBlockOverlay();
    }
    const cellText = firstCell.textContent!;
    const textStart = cellPosition(firstCell) + 2;
    richEditor.commands.setTextSelection({ from: textStart, to: textStart + cellText.length });
    richEditor.view.focus();
    await expect(richEditor.state.selection.empty).toBe(false);
    await expect(await verifyBlockSelection(tableBlock)).toEqual(paragraphSelection);
    await expect(richEditor.state.selection.toJSON().type).toBe('node');
    await verifyTableBlockOverlay();
    richEditor.commands.setTextSelection(textStart + cellText.length);
    richEditor.view.focus();
    await waitFor(() => expect(field).toHaveFocus());
    await expect(table.querySelectorAll('.selectedCell')).toHaveLength(0);
    await userEvent.keyboard(' audit');
    await waitFor(() => expect(firstCell.textContent).toBe(`${cellText} audit`));
    richEditor.commands.undo();
    await waitFor(() => expect(firstCell.textContent).toBe(cellText));
    await verifyTableGeometry();

    const surface = field.closest<HTMLElement>('.note-page-scroll')!;
    // Keep page coordinates while routing subsequent events through pointer capture.
    const capturedRoot = field.closest<HTMLElement>('.rich-editor')!;
    for (const selection of ['caret', 'cells', 'table'] as const) {
      if (selection === 'table') await verifyBlockSelection(tableBlock);
      else {
        if (selection === 'cells') richEditor.commands.setCellSelection({ anchorCell: cellPosition(firstCell), headCell: cellPosition(lastCell) });
        else richEditor.commands.setTextSelection(textStart);
        richEditor.view.focus();
      }
      await waitFor(() => expect(field).toHaveFocus());
      if (selection !== 'table') {
        await expect(canvas.getByRole('group', { name: '表格操作' })).toBeVisible();
        await expect(editor.querySelector('.rich-table-cell-outline')).not.toBeNull();
      }
      const bounds = firstCell.getBoundingClientRect();
      const margin = { clientX: surface.getBoundingClientRect().left + 4, clientY: bounds.top + 8 };
      await userEvent.pointer([{ keys: '[MouseLeft>]', target: surface, coords: margin }, { keys: '[/MouseLeft]', target: capturedRoot, coords: margin }]);
      await waitFor(() => expect(field).not.toHaveFocus());
      await waitFor(() => expect(richEditor.state.selection.empty).toBe(true));
      await expect(canvas.queryByRole('group', { name: '表格操作' })).not.toBeInTheDocument();
      await expect(editor.querySelector('.rich-table-cell-outline')).toBeNull();
      await expect(table.querySelectorAll('.selectedCell')).toHaveLength(0);
      await expect(tableBlock.matches('.rich-selected-block, .ProseMirror-selectednode')).toBe(false);
      await verifyTableGeometry();
    }
    tableBlock.scrollIntoView({ block: 'center' });
    const blockBounds = tableBlock.getBoundingClientRect(), followingBounds = followingBlock.getBoundingClientRect();
    const dragStart = { clientX: surface.getBoundingClientRect().left + 4, clientY: blockBounds.top + 4 };
    const dragEnd = { clientX: field.getBoundingClientRect().left + 24, clientY: followingBounds.bottom - 4 };
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: surface, coords: dragStart },
      { target: capturedRoot, coords: dragEnd },
      { keys: '[/MouseLeft]', target: capturedRoot, coords: dragEnd },
    ]);
    await waitFor(() => expect(richEditor.state.selection.toJSON().type).toBe('blockRange'));
    await expect(Array.from(field.querySelectorAll('.rich-selected-block'))).toEqual([tableBlock, followingBlock]);
    await expect(field).toHaveFocus();
    await expect(editor.querySelector('.rich-selection-box')).toBeNull();
    await verifyTableBlockOverlay();
    const lastBlock = field.lastElementChild as HTMLElement;
    lastBlock.scrollIntoView({ block: 'center' });
    const lastBounds = lastBlock.getBoundingClientRect();
    const bottomStart = { clientX: surface.getBoundingClientRect().left + 4, clientY: lastBounds.top + 2 };
    const bottomEnd = { clientX: field.getBoundingClientRect().left + 24, clientY: field.getBoundingClientRect().bottom + 12 };
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: surface, coords: bottomStart },
      { target: capturedRoot, coords: bottomEnd },
      { keys: '[/MouseLeft]', target: capturedRoot, coords: bottomEnd },
    ]);
    await expect(richEditor.state.doc.content.eq(originalContent)).toBe(true);
    await expect(lastBlock.matches('.rich-selected-block, .ProseMirror-selectednode')).toBe(true);
    lastBlock.scrollIntoView({ block: 'center' });
    const nextClick = { clientX: field.getBoundingClientRect().left + 24, clientY: field.getBoundingClientRect().bottom + 12 };
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: surface, coords: nextClick },
      { keys: '[/MouseLeft]', target: surface, coords: nextClick },
    ]);
    await waitFor(() => expect(richEditor.state.doc.childCount).toBe(originalContent.childCount + 1));
    await expect(richEditor.state.doc.lastChild?.type.name).toBe('paragraph');
    await expect(richEditor.state.doc.lastChild?.content.size).toBe(0);
    richEditor.commands.undo();
    await waitFor(() => expect(richEditor.state.doc.content.eq(originalContent)).toBe(true));
    canvasElement.scrollIntoView({ block: 'start' });
  },
};
export const DetailLayoutMobileRegression: Story = {
  ...DetailLayoutRegression,
  name: '详情排版 · 窄屏块选区回归',
  tags: ['!dev', '!autodocs', 'mobile'],
  globals: DetailLayoutMobile.globals,
  decorators: [Story => <div style={{ maxWidth: 390, marginInline: 'auto' }}><div className="note-page-scroll" style={{ height: '100vh', paddingInline: 16, overflowY: 'auto' }}><Story /></div></div>],
};

export const BlockSelectionGeometry: Story = {
  name: '内容块 · 四周4px选中回归',
  tags: ['!dev', '!autodocs'],
  args: { initialTitle: '内容块间距检查', initialBody: blockSpacingBody },
  decorators: DetailLayoutRegression.decorators,
  play: async ({ canvasElement }) => {
    const field = await within(canvasElement).findByRole('textbox', { name: '笔记内容' });
    const editor = (field as HTMLElement & { editor: TiptapEditor }).editor;
    await canvasElement.ownerDocument.fonts.ready;
    await waitFor(() => expect(field.querySelectorAll('table')).toHaveLength(5));
    const original = editor.state.doc.content, seen = new Set<string>();
    const candidates: { pos: number; element: HTMLElement }[] = [];
    const types = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem', 'blockquote', 'aside', 'codeBlock', 'table', 'image', 'figure', 'blockMath', 'horizontalRule', 'footnoteDefinition', 'preservedMarkdown']);
    editor.state.doc.descendants((node, pos) => {
      if (!types.has(node.type.name) || node.type.name === 'paragraph' && editor.state.doc.resolve(pos).depth !== 0) return;
      const variant = node.type.name === 'heading' ? node.attrs.level : node.type.name === 'aside' ? `${node.attrs.color}:${node.attrs.icon}` : node.type.name === 'codeBlock' ? node.attrs.language : node.type.name === 'table' ? pos : editor.state.doc.resolve(pos).depth;
      const key = `${node.type.name}:${variant}`;
      if (seen.has(key)) return;
      const element = editor.view.nodeDOM(pos);
      if (element instanceof HTMLElement) { seen.add(key); candidates.push({ pos, element }); }
    });
    expect(candidates.length).toBeGreaterThan(25);
    for (const { pos, element } of candidates) {
      element.scrollIntoView({ block: 'center' });
      for (const image of element.querySelectorAll<HTMLImageElement>('img')) await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true));
      const body = element.querySelector<HTMLElement>(':scope > [data-node-view-wrapper]') ?? element;
      const target = body.matches('.rich-table-block') ? body.querySelector<HTMLElement>('table')!
        : body.matches('.rich-image') ? body.querySelector<HTMLElement>('.ui-note-image')! : body;
      if (!target.matches('p, h1, h2, h3, h4, h5, h6, ul, ol, li, hr')) expect(getComputedStyle(target).borderRadius, `${element.tagName}.${element.className}`).toBe('8px');
      const nodes = [element, ...element.querySelectorAll<HTMLElement>('p, li, pre, td, th, img, .rich-callout-content')];
      const layout = () => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, padding: getComputedStyle(node).padding, background: getComputedStyle(node).backgroundColor }));
      const before = layout();
      editor.commands.setNodeSelection(pos); editor.view.focus();
      await verifyHighlight(field, element, target);
      if (target.matches('pre') && target.scrollWidth > target.clientWidth + 1) {
        target.scrollLeft = target.scrollWidth;
        await waitFor(() => expect(target.scrollLeft).toBeGreaterThan(0));
        await verifyHighlight(field, element, target);
        target.scrollLeft = 0;
      }
      expect(layout()).toEqual(before);
      expect(editor.state.doc.content.eq(original)).toBe(true);
      expect(field.querySelector('.rich-block-highlights')).toBeNull();
      const node = editor.state.doc.nodeAt(pos)!;
      let textEnd: number | undefined;
      if (!node.isAtom) node.descendants((child, offset) => {
        if (child.isText && textEnd === undefined) textEnd = pos + 1 + offset + child.nodeSize;
      });
      if (textEnd !== undefined) {
        editor.commands.setTextSelection(textEnd); editor.view.focus();
        await userEvent.keyboard('检');
        expect(editor.state.doc.content.eq(original)).toBe(false);
        expect(field.closest('.rich-editor')!.querySelector('.rich-block-highlights')).toBeNull();
        editor.commands.undo();
        expect(editor.state.doc.content.eq(original)).toBe(true);
        await waitFor(() => expect(layout()).toEqual(before));
      }
    }
    editor.commands.setTextSelection(2); editor.view.focus();
    await userEvent.keyboard('{Control>}a{/Control}{Control>}a{/Control}');
    await waitFor(() => expect(editor.state.selection.toJSON().type).toBe('all'));
    for (const element of Array.from(field.children) as HTMLElement[]) {
      if (!element.matches('.rich-selected-block, .ProseMirror-selectednode')) continue;
      const body = element.querySelector<HTMLElement>(':scope > [data-node-view-wrapper]') ?? element;
      const target = body.matches('.rich-table-block') ? body.querySelector<HTMLElement>('table')!
        : body.matches('.rich-image') ? body.querySelector<HTMLElement>('.ui-note-image')! : body;
      await verifyHighlight(field, element, target);
    }
    expect(field.closest('.rich-editor')!.querySelectorAll('.rich-block-highlights > path')).toHaveLength(1);
    expect(editor.state.doc.content.eq(original)).toBe(true);
    const surface = field.closest<HTMLElement>('.note-page-scroll')!, root = field.closest<HTMLElement>('.rich-editor')!;
    field.firstElementChild!.scrollIntoView({ block: 'center' });
    const point = { clientX: surface.getBoundingClientRect().left + 4, clientY: field.getBoundingClientRect().top + 12 };
    await userEvent.pointer([{ target: surface, coords: point, keys: '[MouseLeft>]' }, { target: root, coords: point, keys: '[/MouseLeft]' }]);
    await waitFor(() => expect(root.querySelector('.rich-block-highlights')).toBeNull());
    expect(editor.state.doc.content.eq(original)).toBe(true);
    canvasElement.scrollIntoView({ block: 'start' });
  },
};
export const BlockSelectionGeometryMobile: Story = {
  ...BlockSelectionGeometry,
  name: '内容块 · 窄屏四周4px选中回归',
  tags: ['!dev', '!autodocs', 'mobile'],
  globals: DetailLayoutMobile.globals,
  decorators: DetailLayoutMobileRegression.decorators,
};

const quoteRailBody = '> 单行引用。\n\n引用之间的正文。\n\n> 引用第一段。\n>\n> 引用第二段。\n>\n> > 嵌套引用。';
export const QuoteRailRegression: Story = {
  name: '引用 · 直线与圆角独立',
  tags: ['!dev', '!autodocs'],
  args: { initialTitle: '引用竖线检查', initialBody: quoteRailBody },
  render: args => <><EditorFixture {...args} /><div className="p-6"><NoteMarkdown body={quoteRailBody} /></div></>,
  play: async ({ canvasElement }) => {
    const field = await within(canvasElement).findByRole('textbox', { name: '笔记内容' });
    await canvasElement.ownerDocument.fonts.ready;
    const quotes = Array.from(canvasElement.querySelectorAll<HTMLElement>('.ui-note-markdown blockquote'));
    expect(quotes).toHaveLength(6);
    for (const quote of quotes) {
      const style = getComputedStyle(quote), rail = getComputedStyle(quote, '::before');
      const bounds = quote.getBoundingClientRect(), first = quote.querySelector('p')!.getBoundingClientRect();
      expect(style.borderRadius).toBe('8px');
      expect(style.borderInlineStartColor).toBe('rgba(0, 0, 0, 0)');
      expect(parseFloat(style.paddingInlineStart)).toBe(parseFloat(style.fontSize));
      expect(first.left - bounds.left).toBeCloseTo(parseFloat(style.paddingInlineStart) + parseFloat(style.borderInlineStartWidth), 1);
      expect(rail.position).toBe('absolute');
      expect(rail.width).toBe(style.borderInlineStartWidth);
      expect(parseFloat(rail.insetInlineStart)).toBe(-parseFloat(style.borderInlineStartWidth));
      expect(rail.top).toBe('0px'); expect(rail.bottom).toBe('0px');
      expect(parseFloat(rail.height)).toBeCloseTo(bounds.height, 1);
      expect(rail.borderRadius).toBe('0px');
      expect(rail.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(rail.pointerEvents).toBe('none');
    }
    const editor = (field as HTMLElement & { editor: TiptapEditor }).editor;
    const original = editor.state.doc.content;
    editor.commands.setNodeSelection(0); editor.view.focus();
    await verifyHighlight(field, field.querySelector('blockquote')!);
    expect(editor.state.doc.content.eq(original)).toBe(true);
  },
};
export const QuoteRailMobileRegression: Story = {
  ...QuoteRailRegression,
  name: '引用 · 窄屏直线与圆角独立',
  tags: ['!dev', '!autodocs', 'mobile'],
  globals: DetailLayoutMobile.globals,
};

const noteRhythmRender = (size: '14' | '16') => (args: Parameters<typeof EditorFixture>[0]) => <div style={resolveTypography({ ...defaults, size }) as CSSProperties}>
  <EditorFixture {...args} />
  <div data-rhythm-reader className="mx-auto max-w-[var(--note-measure)] px-2"><NoteMarkdown body={blockSpacingBody} /></div>
</div>;
export const NoteRhythmRegression: Story = {
  name: '排版 · 16px 编辑与阅读间距',
  tags: ['!dev', '!autodocs'],
  args: { initialTitle: '内容块间距检查', initialBody: blockSpacingBody },
  render: noteRhythmRender('16'),
  parameters: { typographySize: 16 },
  play: async ({ canvasElement, parameters }) => {
    const field = await within(canvasElement).findByRole('textbox', { name: '笔记内容' });
    const size = Number(parameters.typographySize);
    await canvasElement.ownerDocument.fonts.ready;
    const reader = canvasElement.querySelector<HTMLElement>('[data-rhythm-reader] > .ui-note-markdown')!;
    for (const root of [field, reader]) {
      const editing = root === field;
      expect(getComputedStyle(root).fontSize).toBe(`${size}px`);
      expect(parseFloat(getComputedStyle(root).lineHeight)).toBe(size === 14 ? 22 : 24);
      const find = (selector: string, text: string) => Array.from(root.querySelectorAll<HTMLElement>(selector)).find(n => n.textContent?.includes(text))!;
      const bounds = (el: HTMLElement) => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el);
        return { top: r.top + (editing && el.matches('p,h1,h2,h3') ? parseFloat(s.paddingTop) : 0), bottom: r.bottom - (editing && el.matches('p,h1,h2,h3') ? parseFloat(s.paddingBottom) : 0) };
      };
      const gap = (a: HTMLElement, b: HTMLElement, expected = 16) => expect(bounds(b).top - bounds(a).bottom, `${editing ? '编辑' : '阅读'} ${a.tagName}→${b.tagName}`).toBeCloseTo(expected, 1);
      gap(find(':scope > p', '第一段正文。'), find(':scope > p', '第二段正文稍长'));
      for (const [level, expected, small, line, smallLine] of [[1, 30, 26, 40, 34], [2, 24, 22, 32, 28], [3, 20, 18, 26, 24]] as const) {
        const heading = find(`h${level}`, `${['一级','二级','三级'][level - 1]}标题`);
        expect(parseFloat(getComputedStyle(heading).fontSize)).toBe(size === 14 ? small : expected);
        expect(parseFloat(getComputedStyle(heading).lineHeight)).toBe(size === 14 ? smallLine : line);
        gap(heading, heading.nextElementSibling as HTMLElement);
      }
      gap(find(':scope > p', '一级标题后的正文'), find('h2', '二级标题'), 36);
      gap(find(':scope > p', '二级标题后的正文'), find('h3', '三级标题'), 32);
      const firstItem = find('li > p,li', '第一项：检查');
      const secondItem = find('li > p,li', '第二项：这是一条');
      gap(find(':scope > p', '无序列表之前'), firstItem.querySelector('p') ?? firstItem);
      gap(firstItem.querySelector('p') ?? firstItem, secondItem.querySelector('p') ?? secondItem, 6);
      for (const [selector, before, inside, after] of [
        ['blockquote', '引用块之前', '引用的第一段', '引用块之后'],
        ['aside', '无图标提示块之前', '无图标提示块', '带图标提示块之前'],
        ['pre', '代码块之前', 'const title', '代码块之后'],
        ['table', '标准表头表格之前', '内容块', '无表头表格：'],
      ]) {
        const block = find(selector, inside);
        gap(find(':scope > p', before), block);
        gap(block, find(':scope > p', after));
      }
      const image = root.querySelector<HTMLImageElement>('img[alt="单张模拟图片"]')!;
      image.scrollIntoView({ block: 'center' });
      await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true));
      gap(find(':scope > p', '单张图片之前'), image);
      gap(image, find(':scope > p', '单张图片之后'));
      gap(find(':scope > p', '分隔线之前'), root.querySelector('hr')!);
      gap(root.querySelector('hr')!, find(':scope > p', '分隔线之后'));
      let math = root.querySelector<HTMLElement>(editing ? '.rich-math-block' : 'math[display="block"]')!;
      if (!editing) while (math && math.parentElement !== root) math = math.parentElement!;
      expect(!!math, `${editing ? '编辑' : '阅读'}公式块`).toBe(true);
      gap(find(':scope > p', '块级公式之前'), math);
      gap(math, find(':scope > p', '块级公式之后'));
    }
    expect(field.getBoundingClientRect().width).toBeGreaterThan(0);
  },
};
export const NoteRhythmSmallRegression: Story = { ...NoteRhythmRegression, name: '排版 · 14px 编辑与阅读间距', render: noteRhythmRender('14'), parameters: { typographySize: 14 } };
export const NoteRhythmMobileRegression: Story = { ...NoteRhythmRegression, name: '排版 · 窄屏16px间距', tags: ['!dev', '!autodocs', 'mobile'], globals: DetailLayoutMobile.globals };
export const NoteRhythmSmallMobileRegression: Story = { ...NoteRhythmSmallRegression, name: '排版 · 窄屏14px间距', tags: ['!dev', '!autodocs', 'mobile'], globals: DetailLayoutMobile.globals };
export const BlockSelectionSmallGeometry: Story = {
  ...BlockSelectionGeometry,
  name: '内容块 · 14px四周4px选中回归',
  render: args => <div style={resolveTypography({ ...defaults, size: '14' }) as CSSProperties}><EditorFixture {...args} /></div>,
};
export const BlockSelectionSmallMobileGeometry: Story = {
  ...BlockSelectionSmallGeometry,
  name: '内容块 · 窄屏14px四周4px选中回归',
  tags: ['!dev', '!autodocs', 'mobile'],
  globals: DetailLayoutMobile.globals,
  decorators: DetailLayoutMobileRegression.decorators,
};
