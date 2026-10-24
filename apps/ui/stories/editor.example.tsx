import { useRef, useState } from "react";
import type { Note } from "@memocard/contracts";
import { Editor, type EditorHandle } from "../src/Editor";
import { request } from "../src/bridge";
import { NoteCollection } from "../src/components/note-collection";
import { Button } from "../src/components/ui/button";
import { editorDraft, editorVaultBinding, type EditorFixture } from "./editor.fixture";

export type EditorExampleProps = {
  scenario: "ready" | "retry" | "pending" | "readonly";
  fixture: EditorFixture;
  onSaved: (note: Note) => void;
  onCommitted: (note: Note) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

export function EditorExample({ scenario, fixture, onSaved, onCommitted, onClose, onError }: EditorExampleProps) {
  const [note, setNote] = useState(() => fixture.readSaved());
  const [opened, setOpened] = useState<Note | null>(() => fixture.readSaved());
  const [query, setQuery] = useState("");
  const [leaving, setLeaving] = useState(false);
  const handle = useRef<EditorHandle | null>(null);
  const capabilities = new Set(scenario === "readonly" ? [] : ["saveNote", "saveDraft"]);
  async function open(id: string) {
    try { setOpened(await request<Note>("getNote", { id, vaultBinding: editorVaultBinding })); }
    catch (error) { onError(String(error)); }
  }
  return <main className="min-h-dvh bg-body p-4 text-primary md:p-6">
    <p className="mb-4 text-sm text-secondary">真实 Editor、EditorSession 和 NoteCollection；导航按钮是示例调用方，保存与恢复草稿只使用当前示例内存。</p>
    {opened ? <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={leaving} onClick={async () => {
          setLeaving(true);
          try { await handle.current?.finish(); } finally { setLeaving(false); }
        }}>返回笔记集合</Button>
        {scenario === "pending" && <Button variant="outline" size="sm" onClick={fixture.completeSave}>完成模拟保存</Button>}
      </div>
      <div className="note-page-width"><Editor key={opened.contentHash} initial={editorDraft(opened)} initialNote={opened} capabilities={capabilities} handle={handle}
        onClose={() => { setOpened(null); onClose(); }}
        onSaved={saved => { setNote(saved); setOpened(null); onSaved(saved); }}
        onCommitted={saved => { setNote(saved); onCommitted(saved); }} /></div>
    </> : <section aria-label="已保存的笔记集合">
      <h1 className="mb-4 text-xl font-semibold">笔记集合</h1>
      <NoteCollection notes={`${note.title}\n${note.body}`.includes(query) ? [note] : []}
        query={query} onQueryChange={setQuery} searchPlaceholder="搜索当前视图笔记" searchDisabled={false}
        hasMore={false} paging={false} loadMoreDisabled canOpen canCreate={false}
        onNewNote={() => undefined} onOpen={id => void open(id)} onSelectTag={() => undefined}
        onLoadMore={() => undefined} onError={onError} formatDate={value => value.slice(0, 10)}>
        没有找到相关笔记
      </NoteCollection>
    </section>}
  </main>;
}
