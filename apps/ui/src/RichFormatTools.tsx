import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { NotePage } from '@memocard/contracts';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog';
import { Popover } from "@base-ui/react/popover";
import { request } from './bridge';
import { externalUrl, internalTarget } from './urls';
import { editRichStructure } from './rich-blocks';

type Properties = { kind: 'link' | 'abbr'; from: number; to: number; value: string; extra: string; wiki: boolean };
export function RichFormatTools({ editor, onError }: { editor: Editor; onError: (message: string) => void }) {
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
  function show(kind: Properties['kind']) {
    const { from, to } = editor.state.selection;
    const wiki = editor.isActive('wikiLink');
    const value = kind === 'link' ? String(editor.getAttributes(wiki ? 'wikiLink' : 'link')[wiki ? 'target' : 'href'] ?? '') : String(editor.getAttributes('abbr').title ?? '');
    setProperties({ kind, from, to, value, extra: kind === 'link' ? editor.state.doc.textBetween(from, to) : '', wiki }); setOpen(false);
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
    } else editRichStructure(editor, () => { editor.chain().focus().setTextSelection({ from: p.from, to: p.to }).setMark('abbr', { title: p.value }).run(); });
    close();
  }
  return <>
    <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger disabled={!editor.isEditable}>更多格式</Popover.Trigger>
      <Popover.Portal><Popover.Positioner align="end" sideOffset={6} collisionPadding={12} className="z-50"><Popover.Popup className="rich-menu rich-format-menu" aria-label="更多格式" finalFocus={properties ? false : undefined}>
        <div aria-label="扩展文字格式">{[['mark', '高亮'], ['sup', '上标'], ['sub', '下标'], ['kbd', '键盘标记']].map(([mark, label]) => <button key={mark} aria-pressed={editor.isActive(mark)} onClick={() => { editor.chain().focus().toggleMark(mark).run(); setOpen(false); }}>{label}</button>)}
          <button onClick={() => show('abbr')}>缩写说明</button>
          <button onClick={() => show('link')}>编辑链接</button><button disabled={!editor.isActive('link') && !editor.isActive('wikiLink')} onClick={() => { editor.chain().focus().extendMarkRange(editor.isActive('wikiLink') ? 'wikiLink' : 'link').unsetMark('link').unsetMark('wikiLink').run(); setOpen(false); }}>移除链接</button>
        </div>
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>
    <Dialog open={!!properties} onOpenChange={next => { if (!next) close(); }}><DialogContent aria-describedby={undefined} className="rich-properties" finalFocus={() => editor.view.dom}>
      <DialogTitle>{properties && ({ link: '编辑链接', abbr: '缩写说明' })[properties.kind]}</DialogTitle>
      {properties && <>
        {properties.kind === 'link' && <><label>链接类型<select value={properties.wiki ? 'wiki' : 'link'} onChange={e => setProperties({ ...properties, wiki: e.target.value === 'wiki' })}><option value="link">网页或文件链接</option><option value="wiki">Wiki 笔记链接</option></select></label>{properties.wiki && <><input aria-label="搜索目标笔记" placeholder="搜索目标笔记" value={search} onChange={e => setSearch(e.target.value)} /><div className="rich-link-results">{matches.map(note => <button key={note.id} onClick={() => setProperties({ ...properties, value: note.relativePath })}>{note.body.split('\n')[0].replace(/^#+\s*/, '') || note.relativePath}</button>)}</div>{searchError && <p role="status">{searchError}</p>}</>}</>}
        <label>{properties.kind === 'link' ? '链接地址' : '内容'}<textarea aria-label="属性内容" value={properties.value} onChange={e => setProperties({ ...properties, value: e.target.value })} /></label>
        <div><button onClick={close}>取消</button><button onClick={apply}>应用属性</button></div>
      </>}
    </DialogContent></Dialog>
  </>;
}
