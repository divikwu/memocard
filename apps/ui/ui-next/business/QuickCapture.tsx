import { isIOSNative } from "../../src/ios-native";
import { lazy, Suspense, useRef } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import { HugeiconsIcon } from "@hugeicons/react";
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import FolderOpenIcon from "@hugeicons/core-free-icons/FolderOpenIcon";
import HashIcon from "@hugeicons/core-free-icons/HashIcon";
import ImageAdd01Icon from "@hugeicons/core-free-icons/ImageAdd01Icon";
import Loading03Icon from "@hugeicons/core-free-icons/Loading03Icon";
import TelegramIcon from "@hugeicons/core-free-icons/TelegramIcon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import { useQuickCapture, type QuickCaptureProps } from "../../src/hooks/use-quick-capture";
import { useCaptureEditor, type CaptureEditorProps } from "../../src/capture-editor";
import { useRichTagSuggestions } from "../../src/hooks/use-rich-tag-suggestions";
import { hasCapture } from "../../src/quick-capture-draft";
import { assetUrl } from "../../src/urls";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { InputGroup, InputGroupAddon, InputGroupButton } from "../components/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import "./QuickCapture.css";
const VaultImage = lazy(() => import("./NoteMarkdown").then(module => ({ default: module.VaultImage })));

export type { QuickCaptureHandle, QuickCaptureMemory, QuickCaptureProps } from "../../src/hooks/use-quick-capture";

const icons = { add: Add01Icon, send: TelegramIcon, continue: ArrowUpRight01Icon, close: Cancel01Icon, folder: FolderOpenIcon, tag: HashIcon, image: ImageAdd01Icon, loading: Loading03Icon, check: Tick02Icon };
function Icon({ name, className }: { name: keyof typeof icons; className?: string }) { return <HugeiconsIcon icon={icons[name]} aria-hidden="true" strokeWidth={2} className={className || "size-4 shrink-0"} />; }

export function QuickCapture(props: QuickCaptureProps) {
  const { tags: options, canImage, onContinue, draftCount = 0, onOpenDrafts, docked = false, active = true } = props;
  const { expanded, setExpanded, sheetViewport, capture, captureCurrent, draftError, restoreFailed, recordedLocally, busy, error, tagQuery, setTagQuery, tagPickerOpen, setTagPickerOpen, textarea, editorRef, working, continuing, blocked, canRecord, record, continueInPage, image, changeCapture, retryProtection, toggleTag, normalized, known, matches, isMobile } = useQuickCapture(props);
  if (isIOSNative) return null;
  const form = <form className="next-quick-capture" aria-label="快速输入" aria-busy={busy} onSubmit={event => { event.preventDefault(); void record(); }}>
    <InputGroup className="next-capture-group border-border-subtle bg-surface shadow-sm">
      <CaptureEditor value={capture.text} tags={options} resetKey={capture.id} disabled={blocked} field={textarea} editorRef={editorRef} onChange={text => changeCapture({ ...captureCurrent.current, text })} onSave={() => void record()} />
      {capture.images.length > 0 && <div className="next-capture-images" aria-label="待记录的图片">{capture.images.map((image, index) => {
        const source = assetUrl(image.markdownPath, capture.relativePath);
        return <div className="next-capture-image" key={image.relativePath}>{source && <Suspense fallback={<span role="status" className="text-xs text-secondary">正在读取图片…</span>}><VaultImage source={source} alt={`待记录图片 ${index + 1}`} interactive={!blocked} /></Suspense>}<Button type="button" size="icon-xs" variant="secondary" disabled={blocked} aria-label={`移除图片 ${index + 1}`} onClick={() => { const current = captureCurrent.current; changeCapture({ ...current, images: current.images.filter((_, item) => item !== index) }); }}><Icon name="close" /></Button></div>;
      })}</div>}
      <InputGroupAddon align="block-end" className="next-capture-footer">
        <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}><PopoverTrigger render={<InputGroupButton size="sm" className="next-capture-tool" disabled={blocked} aria-label="选择标签" title="选择标签" />}><Icon name="tag" /><span>标签</span></PopoverTrigger>
          <PopoverContent align="start" className="next-capture-tag-picker" aria-label="选择标签" finalFocus={textarea}>
            <Input aria-label="搜索或新建标签" placeholder="搜索或新建标签" value={tagQuery} disabled={blocked} onChange={event => setTagQuery(event.target.value)} />
            <div className="next-capture-tag-options">{matches.map(tag => <Button type="button" key={tag} variant="ghost" size="sm" disabled={blocked} aria-pressed={capture.tags.includes(tag)} onClick={() => toggleTag(tag)}><Icon name="tag" /><span>{tag}</span>{capture.tags.includes(tag) && <Icon name="check" />}</Button>)}
              {normalized && !known.includes(normalized) && <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={() => { toggleTag(normalized); setTagQuery(""); }}>新建标签 {normalized}</Button>}
              {!known.length && !tagQuery && <p>输入名称，创建第一个标签。</p>}
            </div>
          </PopoverContent>
        </Popover>
        <InputGroupButton size="sm" className="next-capture-tool" disabled={blocked || !canImage} aria-label="添加图片" title="添加图片" onClick={() => void image()}><Icon name="image" /><span>图片</span></InputGroupButton>
        <InputGroupButton type="submit" variant="default" size="sm" className="next-capture-submit" disabled={!canRecord} aria-label={busy ? "处理中" : "记录"}><Icon name={busy ? "loading" : "send"} className={busy ? "size-4 animate-spin motion-reduce:animate-none" : undefined} /><span>{busy ? "处理中" : "记录"}</span></InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
    {draftCount > 0 && onOpenDrafts && <div className="next-capture-drafts"><Button type="button" variant="ghost" size="sm" disabled={docked && busy} onClick={() => { if (docked) setExpanded(false); onOpenDrafts(); }}><Icon name="folder" />保留草稿（{draftCount}）</Button></div>}
    {docked && isMobile && onContinue && <Button type="button" variant="outline" className="next-capture-continue" disabled={blocked || restoreFailed} onClick={() => void continueInPage()}><Icon name="continue" />切换为页面</Button>}
    {error && <p role="alert" className="next-capture-error">{error}</p>}
    {isMobile && <div className="next-capture-save-status" role="status" aria-live="polite" aria-atomic="true">{draftError ? <><span className="text-error">{recordedLocally ? "记录已保存，临时草稿未清除。" : draftError}</span><Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={retryProtection}>{restoreFailed ? "重试恢复草稿" : recordedLocally ? "重试清理草稿" : "重试草稿保护"}</Button></> : recordedLocally ? "已保存到本机" : null}</div>}
  </form>;
  if (!docked) return form;
  return <Sheet open={expanded && active} onOpenChange={(open, details) => { if (working.current) details.cancel(); else { if (open) continuing.current = false; setExpanded(open); } }}>
    <SheetTrigger render={<Button type="button" variant="outline" className="next-capture-entry mobile-capture-entry" disabled={blocked} aria-label="打开快速记录" />}><Icon name="add" /><span className="min-w-0 truncate">{capture.text.trim() || (hasCapture(capture) ? "继续未完成的记录…" : "记下此刻的想法…")}</span></SheetTrigger>
    <SheetContent side="bottom" className="next-capture-sheet" style={sheetViewport ?? undefined} initialFocus={textarea} finalFocus={() => continuing.current ? false : true} showCloseButton={false} swipeToClose swipeDisabled={busy}>
      <SheetHeader className="flex-row items-center justify-between p-0"><div><SheetTitle>快速记录</SheetTitle><SheetDescription className="sr-only">记录文字、标签或图片；草稿在本机保护。</SheetDescription></div><SheetCloseButton disabled={busy} aria-label="收起快速记录" /></SheetHeader>
      {form}
    </SheetContent>
  </Sheet>;
}

function CaptureEditor(props: CaptureEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useCaptureEditor({ ...props, className: "next-capture-editor-content" });
  return <div ref={host} className="next-capture-editor" data-empty={!props.value || undefined}><EditorContent editor={editor} />{editor && !props.disabled && <CaptureSuggestions editor={editor} names={props.tags} host={host} />}</div>;
}

function CaptureSuggestions({ editor, names: providedNames, host }: { editor: Editor; names: string[]; host: React.RefObject<HTMLDivElement | null> }) {
  const { active, index, names, options, choose } = useRichTagSuggestions(editor, providedNames, host);
  if (!active) return null;
  return <div role="group" aria-label="标签建议" className="next-capture-suggestions" style={{ left: `min(${active.left}px, max(0px, 100% - 240px))`, top: active.top }}>{options.length ? options.map((name, item) => <Button key={name} type="button" size="sm" variant="ghost" className={item === index ? "bg-muted" : ""} onMouseDown={event => event.preventDefault()} onClick={() => choose(name)}><span>#{name}</span>{!names.includes(name) && <span className="text-xs text-secondary">新标签</span>}</Button>) : <p className="text-xs text-secondary">输入标签名称，空格结束</p>}</div>;
}
