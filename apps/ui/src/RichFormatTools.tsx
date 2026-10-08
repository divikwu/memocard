import { useEffect, useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/react';
import type { NotePage } from '@memocard/contracts';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import { Popover } from 'radix-ui';
import * as Menu from '@radix-ui/react-menu';
import { SlidersHorizontal } from 'lucide-react';
import { request } from './bridge';
import { externalUrl, internalTarget } from './urls';
import { editRichStructure } from './rich-blocks';
import { MarkdownSource } from './wysiwyg-markdown';

type Properties = { kind: 'link' | 'abbr' | 'image' | 'table' | 'source' | 'footnote'; from: number; to: number; pos: number; value: string; extra: string; wiki: boolean };
export function RichFormatTools({ editor, onImage, onError, context }: { context: 'text' | 'block'; editor: Editor; onImage?: (insert: (markdown: string) => void) => void; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<Properties | null>(null);
  const [matches, setMatches] = useState<NotePage['notes']>([]);
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    let active = true;
    if (properties?.kind !== 'link' || !properties.wiki) return;
    const timer = setTimeout(() => { void request<NotePage>('queryNotes', { query: search, tags: [], limit: 12 }).then(page => { if (active) { setMatches(page.notes); setSearchError(''); } }).catch(() => { if (active) setSearchError('无法读取笔记，请直接输入目标路径。'); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [properties?.kind, properties?.wiki, search]);
  function selected(type: string) {
    const { $from, from } = editor.state.selection;
    if (editor.state.doc.nodeAt(from)?.type.name === type) return from;
    for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type.name === type) return $from.before(depth);
    return -1;
  }
  function show(kind: Properties['kind']) {
    const { from, to } = editor.state.selection;
    const pos = kind === 'footnote' ? Math.max(selected('footnoteReference'), selected('footnoteDefinition')) : kind === 'image' ? Math.max(selected('image'), selected('wikiImage')) : kind === 'table' ? selected('table') : kind === 'source' ? selected('preservedMarkdown') : from;
    const attrs = pos >= 0 ? editor.state.doc.nodeAt(pos)?.attrs : undefined;
    const wiki = editor.isActive('wikiLink');
    const value = kind === 'footnote' ? String(attrs?.label ?? '') : kind === 'link' ? String(editor.getAttributes(wiki ? 'wikiLink' : 'link')[wiki ? 'target' : 'href'] ?? '') : kind === 'abbr' ? String(editor.getAttributes('abbr').title ?? '') : kind === 'image' ? String(attrs?.alt ?? '') : kind === 'table' ? String(attrs?.caption ?? '') : String(attrs?.source ?? '');
    setProperties({ kind, from, to, pos, value, extra: kind === 'link' ? editor.state.doc.textBetween(from, to) : '', wiki }); setOpen(false);
  }
  function close() { setProperties(null); editor.view.focus(); }
  function apply() {
    if (!properties || !editor.isEditable) return;
    const p = properties;
    if (p.kind === 'link') {
      if (p.wiki ? !internalTarget(p.value) || /[[\]|\r\n]/.test(p.value) : !(externalUrl(p.value) || internalTarget(p.value))) { onError('请输入有效的网页地址或笔记路径。'); return; }
      let chain = editor.chain().focus().setTextSelection({ from: p.from, to: p.to });
      if (p.from === p.to) chain = chain.extendMarkRange(editor.isActive('wikiLink') ? 'wikiLink' : 'link');
      chain = chain.unsetMark('link').unsetMark('wikiLink');
      const mark = { type: p.wiki ? 'wikiLink' : 'link', attrs: p.wiki ? { target: p.value } : { href: p.value } };
      if (p.from === p.to && !editor.isActive('link') && !editor.isActive('wikiLink')) chain = chain.insertContent({ type: 'text', text: p.extra || p.value, marks: [mark] });
      else chain = chain.setMark(mark.type, mark.attrs);
      editRichStructure(editor, () => { chain.run(); });
    } else if (p.kind === 'footnote') {
      if (!p.value.trim() || /[[\]\s]/.test(p.value)) { onError('脚注编号不能包含空白或方括号。'); return; }
      const old = editor.state.doc.nodeAt(p.pos)?.attrs.label;
      let duplicate = false;
      editor.state.doc.descendants(node => { if (node.type.name === 'footnoteDefinition' && node.attrs.label === p.value && p.value !== old) duplicate = true; });
      if (duplicate) { onError('这个脚注编号已存在。'); return; }
      const tr = editor.state.tr;
      editor.state.doc.descendants((node, pos) => { if (node.type.name.startsWith('footnote') && node.attrs.label === old) tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: p.value }); });
      editRichStructure(editor, () => { editor.view.dispatch(tr); });
    } else if (p.kind === 'abbr') editRichStructure(editor, () => { editor.chain().focus().setTextSelection({ from: p.from, to: p.to }).setMark('abbr', { title: p.value }).run(); });
    else {
      const node = editor.state.doc.nodeAt(p.pos);
      if (!node) return;
      editRichStructure(editor, () => { editor.view.dispatch(editor.state.tr.setNodeMarkup(p.pos, undefined, { ...node.attrs, [p.kind === 'image' ? 'alt' : p.kind === 'table' ? 'caption' : 'source']: p.value })); });
    }
    close();
  }
  function footnote() {
    const labels = new Set<string>(); editor.state.doc.descendants(node => { if (node.type.name.startsWith('footnote')) labels.add(String(node.attrs.label)); });
    let label = 1; while (labels.has(String(label))) label++;
    editRichStructure(editor, () => { editor.chain().focus().insertContent({ type: 'footnoteReference', attrs: { label: String(label) } }).command(({ tr }) => {
      const pos = tr.doc.content.size;
      tr.insert(pos, editor.schema.nodes.footnoteDefinition.create({ label: String(label) }, editor.schema.nodes.paragraph.create()));
      return true;
    }).run(); });
    let pos = 0; editor.state.doc.descendants((node, at) => { if (node.type.name === 'footnoteDefinition' && node.attrs.label === String(label)) pos = at + 2; });
    editor.commands.setTextSelection(pos); setOpen(false);
  }
  function insert(node: JSONContent) { editRichStructure(editor, () => { editor.chain().focus().insertContent(node).run(); }); setOpen(false); }
  const imagePos = Math.max(selected('image'), selected('wikiImage'));
  const trigger = <Popover.Trigger disabled={!editor.isEditable}>{context === 'block' && <SlidersHorizontal aria-hidden="true" />}<span>{context === 'text' ? '更多格式' : '块属性与更多操作'}</span></Popover.Trigger>;
  return <>
    <Popover.Root open={open} onOpenChange={setOpen}>{context === 'block' ? <Menu.Item asChild onSelect={event => event.preventDefault()}>{trigger}</Menu.Item> : trigger}
      <Popover.Portal><Popover.Content className="rich-menu rich-format-menu" align="end" sideOffset={6} collisionPadding={12} onCloseAutoFocus={event => event.preventDefault()}>
        <div aria-label="扩展文字格式">{[['mark', '高亮'], ['sup', '上标'], ['sub', '下标'], ['kbd', '键盘标记']].map(([mark, label]) => <button key={mark} aria-pressed={editor.isActive(mark)} onClick={() => { editor.chain().focus().toggleMark(mark).run(); setOpen(false); }}>{label}</button>)}
          <button onClick={() => show('abbr')}>缩写说明</button>
          <button onClick={() => show('link')}>编辑链接</button><button disabled={!editor.isActive('link') && !editor.isActive('wikiLink')} onClick={() => { editor.chain().focus().extendMarkRange(editor.isActive('wikiLink') ? 'wikiLink' : 'link').unsetMark('link').unsetMark('wikiLink').run(); setOpen(false); }}>移除链接</button>
        </div>
        {context === 'block' && <><button onClick={() => insert({ type: 'details', content: [{ type: 'summary', content: [{ type: 'text', text: '展开内容' }] }, { type: 'paragraph' }] })}>折叠内容</button>
        <button onClick={() => insert({ type: 'dl', content: [{ type: 'dt', content: [{ type: 'text', text: '术语' }] }, { type: 'dd', content: [{ type: 'paragraph', content: [{ type: 'text', text: '释义' }] }] }] })}>定义列表</button>
        <button onClick={footnote}>插入脚注</button>
        <button disabled={Math.max(selected('footnoteReference'), selected('footnoteDefinition')) < 0} onClick={() => show('footnote')}>脚注编号</button>
        <button disabled={Math.max(selected('footnoteReference'), selected('footnoteDefinition')) < 0} onClick={() => {
          const pos = Math.max(selected('footnoteReference'), selected('footnoteDefinition')), node = editor.state.doc.nodeAt(pos);
          const target = node?.type.name === 'footnoteReference' ? 'footnoteDefinition' : 'footnoteReference';
          let destination = -1; editor.state.doc.descendants((item, at) => { if (destination < 0 && item.type.name === target && item.attrs.label === node?.attrs.label) destination = at; });
          if (destination >= 0) editor.chain().focus().setNodeSelection(destination).scrollIntoView().run(); setOpen(false);
        }}>跳转脚注／返回</button>
        <button disabled={imagePos < 0} onClick={() => show('image')}>图片替代文字</button>
        <button disabled={imagePos < 0 || !onImage} onClick={() => { const pos = imagePos; setOpen(false); onImage?.(markdown => {
          const image = new MarkdownSource().parse(editor, markdown).content?.[0];
          const old = editor.state.doc.nodeAt(pos);
          if (image?.type === 'image' && old && ['image', 'wikiImage'].includes(old.type.name)) editRichStructure(editor, () => { editor.commands.insertContentAt({ from: pos, to: pos + old.nodeSize }, { ...image, attrs: { ...image.attrs, alt: old.attrs.alt } }); });
        }); }}>替换图片</button>
        <button disabled={imagePos < 0 || selected('figure') >= 0} onClick={() => { const image = editor.state.doc.nodeAt(imagePos); if (image) editRichStructure(editor, () => { editor.commands.insertContentAt({ from: imagePos, to: imagePos + image.nodeSize }, { type: 'figure', content: [image.toJSON(), { type: 'figcaption', content: [{ type: 'text', text: '图片说明' }] }] }); }); setOpen(false); }}>添加图片说明</button>
        <button disabled={!editor.isActive('table')} onClick={() => show('table')}>表格标题</button>
        <button disabled={selected('preservedMarkdown') < 0} onClick={() => show('source')}>编辑原格式内容</button></>}
      </Popover.Content></Popover.Portal>
    </Popover.Root>
    <Dialog open={!!properties} onOpenChange={next => { if (!next) close(); }}><DialogContent aria-describedby={undefined} className="rich-properties" onCloseAutoFocus={event => { event.preventDefault(); editor.view.focus(); }}>
      <DialogTitle>{properties && ({ link: '编辑链接', abbr: '缩写说明', image: '图片替代文字', table: '表格标题', source: '编辑原格式内容', footnote: '脚注编号' })[properties.kind]}</DialogTitle>
      {properties && <>
        {properties.kind === 'link' && <><label>链接类型<select value={properties.wiki ? 'wiki' : 'link'} onChange={e => setProperties({ ...properties, wiki: e.target.value === 'wiki' })}><option value="link">网页或文件链接</option><option value="wiki">Wiki 笔记链接</option></select></label>{properties.wiki && <><input aria-label="搜索目标笔记" placeholder="搜索目标笔记" value={search} onChange={e => setSearch(e.target.value)} /><div className="rich-link-results">{matches.map(note => <button key={note.id} onClick={() => setProperties({ ...properties, value: note.relativePath })}>{note.body.split('\n')[0].replace(/^#+\s*/, '') || note.relativePath}</button>)}</div>{searchError && <p role="status">{searchError}</p>}</>}</>}
        <label>{properties.kind === 'link' ? '链接地址' : properties.kind === 'image' ? '替代文字' : properties.kind === 'source' ? '原始内容' : '内容'}<textarea aria-label="属性内容" value={properties.value} onChange={e => setProperties({ ...properties, value: e.target.value })} /></label>
        <div><button onClick={close}>取消</button><button onClick={apply}>应用属性</button></div>
      </>}
    </DialogContent></Dialog>
  </>;
}
