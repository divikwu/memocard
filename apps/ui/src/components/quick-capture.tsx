import { ArrowUp, ArrowUpRight, Check, FolderOpen, Hash, ImagePlus, LoaderCircle, Plus, X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton } from './ui/input-group';
import { QuickCaptureEditor } from './quick-capture-editor';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { NoteImage } from '../NoteImage';
import { assetUrl } from '../urls';
import { hasCapture } from '../quick-capture-draft';
import { isIOSNative } from '../ios-native';
import { useQuickCapture, type QuickCaptureProps } from '../hooks/use-quick-capture';
import '../quick-capture.css';

export type { QuickCaptureHandle, QuickCaptureMemory, QuickCaptureProps } from '../hooks/use-quick-capture';

export function QuickCapture(props: QuickCaptureProps) {
  const {tags:options,canImage,onContinue,draftCount=0,onOpenDrafts,docked=false,active=true}=props;
  const {expanded,setExpanded,sheetViewport,capture,captureCurrent,draftError,restoreFailed,recordedLocally,busy,error,tagQuery,setTagQuery,tagPickerOpen,setTagPickerOpen,textarea,editorRef,working,continuing,blocked,canRecord,record,continueInPage,image,changeCapture,retryProtection,toggleTag,normalized,known,matches,isMobile}=useQuickCapture(props);
  if(isIOSNative)return null;
  const form = <form className="quick-capture" aria-label="快速输入" aria-busy={busy} onSubmit={event=>{event.preventDefault();void record();}}>
    <InputGroup className="quick-capture-group has-disabled:bg-body shadow-md">
      <QuickCaptureEditor value={capture.text} tags={options} resetKey={capture.id} disabled={blocked} field={textarea} editorRef={editorRef} onChange={text=>changeCapture({...captureCurrent.current,text})} onSave={()=>void record()}/>
      {capture.images.length>0 && <div className="quick-capture-images" aria-label="待记录的图片">{capture.images.map((image,index)=>{
        const source=assetUrl(image.markdownPath,capture.relativePath);
        return <div className="quick-capture-image" key={image.relativePath}>{source && <NoteImage source={source} alt={`待记录图片 ${index+1}`} />}
          <Button type="button" variant="secondary" size="icon-xs" disabled={blocked} aria-label={`移除图片 ${index+1}`} onClick={()=>changeCapture({...capture,images:capture.images.filter((_,i)=>i!==index)})}><X /></Button>
        </div>;
      })}</div>}
      <InputGroupAddon align="block-end" className="quick-capture-footer">
        <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}><PopoverTrigger render={<InputGroupButton size="sm" disabled={blocked} aria-label="选择标签" title="选择标签"><Hash />标签</InputGroupButton>} />
          <PopoverContent align="start" className="quick-capture-tag-picker" aria-label="选择标签" finalFocus={textarea}>
            <Input aria-label="搜索或新建标签" placeholder="搜索或新建标签" value={tagQuery} disabled={blocked} onChange={event=>setTagQuery(event.target.value)} />
            <div className="quick-capture-tag-options">{matches.map(tag=><Button type="button" key={tag} variant="ghost" size="sm" disabled={blocked} aria-pressed={capture.tags.includes(tag)} onClick={()=>toggleTag(tag)}><Hash className="size-3.5" /><span>{tag}</span>{capture.tags.includes(tag) && <Check className="size-3.5" />}</Button>)}
              {normalized && !known.includes(normalized) && <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={()=>{toggleTag(normalized);setTagQuery('');}}>新建标签 {normalized}</Button>}
              {!known.length && !tagQuery && <p>输入名称，创建第一个标签。</p>}
            </div>
          </PopoverContent>
        </Popover>
        <InputGroupButton size="sm" disabled={blocked || !canImage} aria-label="添加图片" title="添加图片" onClick={()=>void image()}><ImagePlus />图片</InputGroupButton>
        <span className="quick-capture-shortcut">⌘ / Ctrl + Enter</span>
        <InputGroupButton type="submit" variant="default" size="sm" className="quick-capture-submit" disabled={!canRecord}>{busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}{busy ? '处理中' : '记录'}</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
    {draftCount>0 && onOpenDrafts && <div className="quick-capture-drafts"><Button type="button" variant="ghost" size="sm" disabled={docked && busy} onClick={()=>{if(docked)setExpanded(false);onOpenDrafts();}}><FolderOpen aria-hidden="true" />保留草稿（{draftCount}）</Button></div>}
    {docked && isMobile && onContinue && <Button type="button" variant="outline" className="quick-capture-continue" disabled={blocked || restoreFailed} onClick={()=>void continueInPage()}><ArrowUpRight aria-hidden="true" />切换为页面</Button>}
    {error && <p role="alert" className="quick-capture-error">{error}</p>}
    {isMobile && <div className="quick-capture-save-status" role="status" aria-live="polite" aria-atomic="true">
      {draftError ? <><span className="text-error">{recordedLocally ? '记录已保存，临时草稿未清除。' : draftError}</span><Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={retryProtection}>{restoreFailed ? '重试恢复草稿' : recordedLocally ? '重试清理草稿' : '重试草稿保护'}</Button></>
        : recordedLocally ? '已保存到本机' : hasCapture(capture) ? '草稿已保存在本机，点击「记录」完成保存' : null}
    </div>}
  </form>;
  if (!docked) return form;
  return <Sheet open={expanded && active} onOpenChange={(open,details)=>{if(working.current)details.cancel();else {if(open)continuing.current=false;setExpanded(open);}}}>
    <SheetTrigger render={<Button type="button" variant="outline" className="mobile-capture-entry" disabled={blocked} aria-label="打开快速记录" />}>
      <Plus aria-hidden="true" className="size-5 shrink-0" /><span className="min-w-0 truncate">{capture.text.trim() || (hasCapture(capture) ? '继续未完成的记录…' : '记下此刻的想法…')}</span>
    </SheetTrigger>
    <SheetContent side="bottom" className="mobile-capture-sheet" style={sheetViewport ?? undefined} initialFocus={textarea} finalFocus={()=>continuing.current ? false : true} showCloseButton={false} swipeToClose swipeDisabled={busy}>
      <SheetHeader className="flex-row items-center justify-between p-0"><SheetTitle>快速记录</SheetTitle><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label="收起快速记录" />}><X aria-hidden="true" /></SheetClose></SheetHeader>
      {form}
    </SheetContent>
  </Sheet>;
}
