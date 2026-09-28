import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Hash, ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { request, errorMessage, isBrowserVault, isLocalWeb, type Attachment, type Draft } from "./bridge";
import type { Note } from "@memocard/contracts";
import { LiveMarkdownEditor } from "./LiveMarkdownEditor";

export function Editor({ initial, capabilities, pendingLink = false, onClose, onSaved }: {
  initial: Draft;
  capabilities: Set<string>;
  pendingLink?: boolean;
  onClose: () => void;
  onSaved: (note: Note) => void;
}) {
  const field = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState(initial.body);
  const [notePath, setNotePath] = useState(initial.relativePath ?? `notes/${initial.id}.md`);
  const [tags, setTags] = useState(initial.tags);
  const [tagInput, setTagInput] = useState("");
  const draftTags = useMemo(() => {
    const added = tagInput.trim();
    return added && !tags.includes(added) ? [...tags, added] : tags;
  }, [tags, tagInput]);
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pendingDraft = useRef<Promise<unknown>>(Promise.resolve());
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftWasWritten = useRef(Boolean(initial.updatedAt));
  const lastQueuedDraft = useRef(JSON.stringify([initial.body, initial.tags]));
  const latestDraft = useRef(lastQueuedDraft.current);
  const [persistedDraft, setPersistedDraft] = useState(lastQueuedDraft.current);
  const canDraft = capabilities.has("saveDraft");
  const dirty = body !== initial.body || JSON.stringify(draftTags) !== JSON.stringify(initial.tags);

  // Serialize writes so a slow autosave cannot overwrite a newer draft.
  const writeDraft = useCallback((draftBody: string, draftTags: string[]) => {
    draftWasWritten.current = true;
    lastQueuedDraft.current = JSON.stringify([draftBody, draftTags]);
    const write = pendingDraft.current.catch(() => undefined).then(() => request("saveDraft", {
      id: initial.id, body: draftBody, tags: draftTags, baseHash: initial.baseHash, relativePath: notePath,
      ...(initial.vaultBinding ? { vaultBinding: initial.vaultBinding } : {}),
      ...(initial.draftKey ? { draftKey: initial.draftKey } : {}),
    })).then((value) => { setPersistedDraft(JSON.stringify([draftBody, draftTags])); return value; });
    pendingDraft.current = write;
    return write;
  }, [initial.id, initial.baseHash, initial.vaultBinding, initial.draftKey, notePath]);

  useEffect(() => {
    if ((!isLocalWeb && !isBrowserVault) || JSON.stringify([body, draftTags]) === persistedDraft) return;
    const protectUnsaved = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protectUnsaved);
    return () => window.removeEventListener("beforeunload", protectUnsaved);
  }, [body, draftTags, persistedDraft]);

  useEffect(() => {
    const key = JSON.stringify([body, draftTags]);
    latestDraft.current = key;
    if (!canDraft || (!dirty && !draftWasWritten.current) || working || lastQueuedDraft.current === key) return;
    const timer = setTimeout(() => {
      draftTimer.current = undefined;
      setDraftState("saving");
      void writeDraft(body, draftTags).then(() => {
        if (latestDraft.current === key) setDraftState("saved");
      }).catch((cause: unknown) => {
        setDraftState("error");
        setError(errorMessage(cause));
      });
    }, 650);
    draftTimer.current = timer;
    return () => clearTimeout(timer);
  }, [body, draftTags, canDraft, dirty, working, writeDraft]);

  async function closeEditor() {
    if (busy.current) return;
    clearTimeout(draftTimer.current);
    if ((dirty || draftWasWritten.current) && canDraft) {
      busy.current = true;
      setWorking(true);
      try {
        await writeDraft(body, draftTags);
      } catch (cause) {
        setError(errorMessage(cause));
        setDraftState("error");
        busy.current = false;
        setWorking(false);
        return;
      }
    } else if (dirty) {
      setError("此版本暂不能保存草稿，请先保存笔记再关闭。");
      return;
    }
    onClose();
  }

  async function save() {
    if (!body.trim() || busy.current || !capabilities.has("saveNote")) return;
    clearTimeout(draftTimer.current);
    busy.current = true;
    setWorking(true);
    setError("");
    try {
      if (canDraft) await writeDraft(body, draftTags);
      const note = await request<Note>("saveNote", {
        id: initial.id, body, tags: draftTags, baseHash: initial.baseHash, relativePath: notePath,
        ...(initial.vaultBinding ? { vaultBinding: initial.vaultBinding } : {}),
        ...(initial.draftKey ? { draftKey: initial.draftKey } : {}),
      });
      onSaved(note);
    } catch (cause) {
      setError(errorMessage(cause));
      busy.current = false;
      setWorking(false);
    }
  }

  async function addImage() {
    if (busy.current || !capabilities.has("pickImage")) return;
    busy.current = true;
    setWorking(true);
    setError("");
    try {
      const image = await request<Attachment | null>("pickImage", { noteId: initial.id, notePath, ...(initial.vaultBinding ? { vaultBinding: initial.vaultBinding } : {}) });
      if (image) {
        if (image.notePath) setNotePath(image.notePath);
        setBody((current) => `${current}${current ? "\n\n" : ""}![图片](${image.markdownPath})\n\n`);
        setDraftState("idle");
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }

  return <Dialog open onOpenChange={(open, event) => {
    if (!open) {
      event.cancel();
      void closeEditor();
    }
  }}>
    <DialogContent
      showCloseButton={false}
      initialFocus={field}
      className="flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(680px,calc(100dvh-48px))] sm:max-w-[720px] sm:rounded-xl sm:border"
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))] sm:px-6">
        <div className="flex items-center gap-3">
          <div>
            <DialogTitle className="text-base font-semibold">{initial.baseHash ? "编辑笔记" : "新建笔记"}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">支持 Markdown，内容自动保存为草稿。</DialogDescription>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={notePath}>保存到：{notePath.split("/").slice(0, -1).map((part, index) => index === 0 ? "笔记目录" : part).join(" / ")}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void closeEditor()} disabled={working} aria-label="保存草稿并关闭"><X className="size-4" /></Button>
      </header>
      {pendingLink && <div className="shrink-0 px-5 pt-4 sm:px-6"><Alert className="bg-muted/40"><AlertDescription role="status">收到另一条笔记的链接。保存或关闭当前笔记后，将为你打开。</AlertDescription></Alert></div>}
      <div className="min-h-0 flex-1 overflow-hidden py-3">
        <LiveMarkdownEditor
          ref={field}
          value={body}
          notePath={notePath}
          onChange={(value) => { setBody(value); setDraftState("idle"); }}
          disabled={working}
          onSave={() => void save()}
          onError={setError}
        />
      </div>
      <div className="shrink-0 border-t px-5 py-2 sm:px-6">
        {tags.length > 0 && <ul aria-label="已有标签" className="mb-1 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
          {tags.map((name, index) => <li key={`${index}-${name}`}><Button variant="secondary" size="sm" className="h-7 max-w-full gap-1.5 px-2 text-xs font-normal" disabled={working} aria-label={`移除标签 ${name}`} onClick={() => { setTags((current) => current.filter((_, position) => position !== index)); setDraftState("idle"); }}><span className="break-all whitespace-normal">{name}</span><X className="size-3 shrink-0" /></Button></li>)}
        </ul>}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Hash className="size-4 shrink-0" aria-hidden="true" />
          <Input
            aria-label="添加标签"
            placeholder="输入完整标签，按 Enter 添加"
            value={tagInput}
            disabled={working}
            onChange={(event) => { setTagInput(event.target.value); setDraftState("idle"); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                event.preventDefault();
                setTags(draftTags); setTagInput("");
              }
            }}
            className="h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="确认添加标签" disabled={working || !tagInput.trim()} onClick={() => { setTags(draftTags); setTagInput(""); }}><Plus className="size-4" /></Button>
        </div>
      </div>
      {error && <div className="shrink-0 px-5 pb-3 sm:px-6"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>}
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t bg-background px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {capabilities.has("pickImage") && <Button variant="ghost" size="icon" aria-label="添加本地图片" title="添加本地图片" onClick={() => void addImage()} disabled={working}><ImagePlus className="size-4" /></Button>}
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {draftState === "saving" ? "草稿保存中…" : draftState === "saved" ? <><Check className="size-3 shrink-0" /><span className="truncate">草稿已存本机</span></> : draftState === "error" ? "草稿未保存" : `${body.length} 字符`}
          </span>
        </div>
        <Button disabled={working || !body.trim() || !capabilities.has("saveNote")} onClick={() => void save()}>
          {working && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}
          保存笔记
          <kbd className="ml-2 hidden text-[11px] opacity-60 sm:inline">⌘ ↵</kbd>
        </Button>
      </footer>
    </DialogContent>
  </Dialog>;
}
