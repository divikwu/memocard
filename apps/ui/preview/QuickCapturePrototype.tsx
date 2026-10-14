// Throwaway UI: local image previews and in-memory records only.
import { useRef, useState } from "react";
import { ArrowUp, Check, Hash, ImagePlus, X } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "./ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "../src/components/ui/popover";
import { Button } from "../src/components/ui/button";
import TagPill from "../src/TagPill";
import "./quick-capture-prototype.css";

export type CaptureImage = { src: string; name: string };
export type CaptureValue = { text: string; tags: string[]; images: CaptureImage[] };

export function QuickCapturePrototype({ onRecord }: { onRecord: (value: CaptureValue) => void }) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<CaptureImage[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const canRecord = Boolean(text.trim() || images.length);
  function record() {
    if (!canRecord) return;
    onRecord({ text: text.trim(), tags, images });
    setText(""); setTags([]); setImages([]);
    requestAnimationFrame(() => textarea.current?.focus());
  }
  function toggleTag(tag: string) { setTags(current => current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag]); }
  return <form className="quick-capture" aria-label="快速输入" onSubmit={event => { event.preventDefault(); record(); }}>
    <InputGroup className="quick-capture-group has-disabled:opacity-100 has-disabled:bg-background">
      <InputGroupTextarea ref={textarea} aria-label="快速输入内容" placeholder="记下此刻的想法…" value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
        if (!event.nativeEvent.isComposing && (event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); record(); }
      }} className="quick-capture-textarea" />
      {images.length > 0 && <div className="quick-capture-images" aria-label="待记录的图片">{images.map((image, index) => <div className="quick-capture-image" key={image.src}>
        <img src={image.src} alt={image.name} />
        <Button type="button" variant="secondary" size="icon-xs" aria-label={`移除图片 ${image.name}`} onClick={() => { URL.revokeObjectURL(image.src); setImages(current => current.filter((_, i) => i !== index)); }}><X /></Button>
      </div>)}</div>}
      {tags.length > 0 && <div className="quick-capture-tags" aria-label="已选标签">{tags.map(tag => <TagPill key={tag} name={tag} render={<button type="button" aria-label={`移除标签 ${tag}`} onClick={() => toggleTag(tag)} />}><span>{tag}</span><X className="size-3" /></TagPill>)}</div>}
      <InputGroupAddon align="block-end" className="quick-capture-footer">
        <Popover><PopoverTrigger render={<InputGroupButton size="sm" aria-label="选择标签" title="选择标签"><Hash />标签</InputGroupButton>} />
          <PopoverContent align="start" className="quick-capture-tag-picker" aria-label="选择标签">
            <p>标签</p>
            {["工作", "设计系统", "产品设计", "阅读", "生活"].map(tag => <Button type="button" key={tag} variant="ghost" size="sm" aria-pressed={tags.includes(tag)} onClick={() => toggleTag(tag)}><Hash className="size-3.5" /><span>{tag}</span>{tags.includes(tag) && <Check className="size-3.5" />}</Button>)}
          </PopoverContent>
        </Popover>
        <InputGroupButton size="sm" aria-label="添加图片" title="添加图片" onClick={() => picker.current?.click()}><ImagePlus />图片</InputGroupButton>
        <span className="quick-capture-shortcut">⌘ / Ctrl + Enter</span>
        <InputGroupButton type="submit" variant="default" size="sm" className="quick-capture-submit" disabled={!canRecord}><ArrowUp />记录</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
    <input ref={picker} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple tabIndex={-1} aria-label="选择图片文件" onChange={event => {
      const files = Array.from(event.target.files ?? []);
      setImages(current => [...current, ...files.map(file => ({src: URL.createObjectURL(file), name: file.name}))]);
      event.target.value = "";
    }} />
  </form>;
}
