import type { Editor } from '@tiptap/react';
import { useRichTagSuggestions } from './hooks/use-rich-tag-suggestions';

export function RichTagSuggestions({ editor, names:providedNames }: { editor: Editor; names?:string[] }) {
  const {active,index,names,options,choose}=useRichTagSuggestions(editor,providedNames);
  if (!active) return null;
  return <div className="rich-tag-suggestions" role="group" aria-label="标签建议" style={{ left: `min(${active.left}px, max(0px, 100% - 18rem))`, top: active.top }}>
    {options.length ? options.map((name, i) => <button key={name} type="button" className={i === index ? 'bg-overlay-hover' : ''} data-highlighted={i === index || undefined} onMouseDown={event => event.preventDefault()} onClick={() => choose(name)}><span className="rich-tag-suggestion-name">#{name}</span>{!names.includes(name) && <span className="rich-tag-suggestion-hint">新标签</span>}</button>) : <span className="rich-tag-suggestion-empty">输入标签名称，空格结束</span>}
  </div>;
}
